const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

async function getSecret(secretName) {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({ name: secretName });
  return version.payload.data.toString();
}

exports.createStripeSession = functions.https.onRequest(async (req, res) => {
  // CORS for local dev or prod
  const allowedOrigins = ['https://app.allproperly.com', 'http://localhost:5173'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).send('');
  }
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const stripeSecretKey = await getSecret('projects/650294800122/secrets/Stripe_Secret_Key/versions/latest');
    const stripe = require('stripe')(stripeSecretKey);
    // Fetch price IDs from Secret Manager
    const basicMonthlyPriceId = await getSecret('projects/650294800122/secrets/Stripe_Basic_Monthly_PriceID/versions/latest');
    const basicAnnualPriceId = await getSecret('projects/650294800122/secrets/Stripe_Basic_Annual_PriceID/versions/latest');
    const plusMonthlyPriceId = await getSecret('projects/650294800122/secrets/Stripe_Plus_Monthly_PriceID/versions/latest');
    const plusAnnualPriceId = await getSecret('projects/650294800122/secrets/Stripe_Plus_Annual_PriceID/versions/latest');

    const { userId, plan } = req.body;
    if (!userId || !plan) {
      return res.status(400).json({ error: 'Missing userId or plan' });
    }
    // plan is 'basic', 'plus', 'basic_annual', or 'plus_annual'
    // Retrieve user data and Stripe customer ID from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const userEmail = userData && userData.email ? userData.email : undefined;
    let stripeCustomerId = userData && userData.stripeCustomerId;

    // Only validate existing customer if we have one (for upgrades/downgrades)
    // New customers will be created by Stripe Checkout automatically
    if (stripeCustomerId) {
      try {
        await stripe.customers.retrieve(stripeCustomerId);
      } catch (err) {
        if (err.code === 'resource_missing' || err.statusCode === 404) {
          console.warn(`Stripe customer ${stripeCustomerId} not found in Stripe. Will use customer_email for checkout.`);
          stripeCustomerId = null; // Reset so checkout creates a new customer
        } else {
          console.error('Error validating Stripe customer:', err);
          return res.status(500).json({ error: 'Failed to validate Stripe customer.' });
        }
      }
    }

    // Property limits for each plan
    const planLimits = {
      free: 1,
      basic: 5,
      plus: 10,
      basic_annual: 5,
      plus_annual: 10
    };

    const priceLimits = {
      free: 0,
      basic: 1,
      plus: 2,
      basic_annual: 3,
      plus_annual: 4
    };

    // Determine if this is a downgrade by comparing current and requested plan limits
    const currentPlan = (userData && userData.planState) ? userData.planState : 'free';
    const requestedLimit = planLimits[plan] || 1;
    const currentPriceLimit = priceLimits[currentPlan] || 0;
    const requestedPriceLimit = priceLimits[plan] || 0;
    const isDowngrade = requestedPriceLimit < currentPriceLimit;

    // Only fetch subscriptions if customer exists (for upgrades/downgrades)
    let subscriptions = { data: [] };
    if (stripeCustomerId) {
      subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'active',
        limit: 10
      });
    }
    
    // Only create or update a subscription for paid plans
    let priceId = null;
    if (plan === 'basic') priceId = basicMonthlyPriceId;
    else if (plan === 'plus') priceId = plusMonthlyPriceId;
    else if (plan === 'basic_annual') priceId = basicAnnualPriceId;
    else if (plan === 'plus_annual') priceId = plusAnnualPriceId;
    console.log('DEBUG: Selected priceId for plan', plan, ':', priceId);

    if (isDowngrade) {
      // Directly implement property count logic here
      async function getSharedPropertyCountForUser(userId) {
        const propertiesSnap = await admin.firestore().collection('properties').get();
        let count = 0;
        propertiesSnap.forEach(doc => {
          const data = doc.data();
          // Count if user is owner
          if (data.ownerId === userId) {
            count++;
            return;
          }
          // Count if user is in sharedWith
          if (Array.isArray(data.sharedWith) && data.sharedWith.some(sw => sw.userId === userId)) {
            count++;
          }
        });
        return count;
      }
      let totalCount = 0;
      try {
        totalCount = await getSharedPropertyCountForUser(userId);
      } catch (err) {
        console.error('Error fetching property count:', err);
        return res.status(500).json({ error: 'Failed to check property count for downgrade.' });
      }
      const limit = requestedLimit;
      if (totalCount > limit) {
        return res.status(400).json({
          error: `You have ${totalCount} properties, but the ${plan} plan allows only ${limit}. Please reduce your properties before downgrading.`,
          totalCount,
          plan,
          limit,
          overLimitCount: totalCount - limit
        });
      }

      if (plan === 'free') {
        // Cancel all subscriptions if downgrading to free
        let cancelledCount = 0;
        let errors = [];
        for (const sub of subscriptions.data) {
          try {
            await stripe.subscriptions.cancel(sub.id); // Immediate cancellation
            cancelledCount++;
          } catch (err) {
            console.error('Error cancelling subscription:', err);
            errors.push({ id: sub.id, error: err.message });
          }
        }
        return res.json({
          found: subscriptions.data.length,
          cancelled: cancelledCount,
          errors,
          updatedPlan: plan,
          success: true,
          message: 'All subscriptions cancelled for downgrade to free.'
        });
      }

      // Schedule plan change at period end for yearly to monthly downgrade
      const activeSub = subscriptions.data[0];
      if (!activeSub) {
        return res.status(400).json({ error: 'No active subscription found for downgrade.' });
      }
      try {
        // If downgrading from yearly to monthly, schedule update at period end
        const currentPriceId = activeSub.items.data[0].price.id;
        const yearlyPriceIds = [basicAnnualPriceId, plusAnnualPriceId];
        const monthlyPriceIds = [basicMonthlyPriceId, plusMonthlyPriceId];
        if (yearlyPriceIds.includes(currentPriceId) && monthlyPriceIds.includes(priceId)) {
          // Always use immediate update with proration (pending_update is not supported)
          try {
            await stripe.subscriptions.update(activeSub.id, {
              items: [{
                id: activeSub.items.data[0].id,
                price: priceId,
              }],
              proration_behavior: 'create_prorations',
              metadata: { userId, plan },
            });
            return res.json({
              updatedPlan: plan,
              success: true,
              message: 'Subscription downgraded to new plan.'
            });
          } catch (err) {
            console.error('Error downgrading subscription:', err);
            return res.status(500).json({ error: 'Failed to downgrade subscription.', stripeError: err.message });
          }
        } else {
          // Standard downgrade: update immediately
          await stripe.subscriptions.update(activeSub.id, {
            items: [{
              id: activeSub.items.data[0].id,
              price: priceId,
            }],
            proration_behavior: 'create_prorations',
            metadata: { userId, plan },
          });
          return res.json({
            updatedPlan: plan,
            success: true,
            message: 'Subscription downgraded to new plan.'
          });
        }
      } catch (err) {
        console.error('Error downgrading subscription:', err);
        return res.status(500).json({ error: 'Failed to downgrade subscription.' });
      }
    }

    const activeSub = subscriptions.data[0];

    if (activeSub) {
      // Calculate the current and new plan prices
      try {
        const currentPriceId = activeSub.items.data[0].price.id;
        const currentPrice = await stripe.prices.retrieve(currentPriceId);
        const newPrice = await stripe.prices.retrieve(priceId);
        const currentAmount = currentPrice.unit_amount || 0;
        const newAmount = newPrice.unit_amount || 0;

        console.log(currentPriceId, currentAmount, newPrice.id, newAmount, "========");

        // Use Stripe's standard proration logic for upgrades
        // This will automatically calculate the prorated difference
        await stripe.subscriptions.update(activeSub.id, {
          items: [{
            id: activeSub.items.data[0].id,
            price: priceId,
          }],
          proration_behavior: 'create_prorations', // Standard Stripe proration
          metadata: { userId, plan },
        });

        // Force creation, finalization, and payment of proration invoice immediately
        const invoice = await stripe.invoices.create({ customer: stripeCustomerId });
        await stripe.invoices.finalizeInvoice(invoice.id);
        // Only pay if invoice is not already paid
        const finalizedInvoice = await stripe.invoices.retrieve(invoice.id);
        if (finalizedInvoice.status !== 'paid') {
          await stripe.invoices.pay(invoice.id);
          console.log('DEBUG: Immediate proration invoice created and paid:', invoice.id);
        } else {
          console.log('DEBUG: Invoice already paid:', invoice.id);
        }

        // Fetch and update invoice history in Firestore
        let invoiceHistory = [];
        try {
          const invoices = await stripe.invoices.list({ customer: stripeCustomerId, limit: 10 });
          invoiceHistory = invoices.data.map(inv => ({
            id: inv.id,
            amount_paid: inv.amount_paid / 100,
            date: new Date(inv.created * 1000).toISOString(),
            status: inv.status,
            url: inv.hosted_invoice_url || null,
          }));
        } catch (err) {
          console.warn('Could not fetch invoice history:', err.message);
        }
        await admin.firestore().collection('users').doc(userId).update({ invoice_history: invoiceHistory });

        return res.json({ success: 'Subscription upgraded and immediate proration charged', updatedPlan: plan });
      } catch (err) {
        console.error('Error upgrading subscription:', err);
        return res.status(500).json({ error: 'Failed to upgrade subscription' });
      }
    } else {
      // No active subscription: create a new one via Checkout
      // Build checkout session options
      const sessionOptions = {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: 'https://app.allproperly.com/?checkout=success',
        cancel_url: 'https://app.allproperly.com/?checkout=cancel',
        metadata: { userId, plan },
      };

      // Use existing customer if available, otherwise use customer_email
      // Stripe will create the customer only when checkout is completed
      if (stripeCustomerId) {
        sessionOptions.customer = stripeCustomerId;
      } else {
        sessionOptions.customer_email = userEmail;
        sessionOptions.customer_creation = 'always';
      }

      const session = await stripe.checkout.sessions.create(sessionOptions);

      // Update subscriptionUpdatedDate in Firestore
      const subscriptionUpdatedDate = new Date().toISOString();
      try {
        await admin.firestore().collection('users').doc(userId).update({ subscriptionUpdatedDate });
      } catch (err) {
        console.error('Error saving subscriptionUpdatedDate to Firestore:', err);
      }

      // Fetch and update invoice history in Firestore (only if customer exists)
      let invoiceHistory = [];
      if (stripeCustomerId) {
        try {
          const invoices = await stripe.invoices.list({ customer: stripeCustomerId, limit: 10 });
          invoiceHistory = invoices.data.map(inv => ({
            id: inv.id,
            amount_paid: inv.amount_paid / 100,
            date: new Date(inv.created * 1000).toISOString(),
            status: inv.status,
            url: inv.hosted_invoice_url || null,
          }));
        } catch (err) {
          console.warn('Could not fetch invoice history:', err.message);
        }
        try {
          await admin.firestore().collection('users').doc(userId).update({ invoice_history: invoiceHistory });
        } catch (err) {
          console.error('Error saving invoice history to Firestore:', err);
        }
      }
      return res.json({ url: session.url, updatedPlan: plan, subscriptionUpdatedDate });
    }
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
});
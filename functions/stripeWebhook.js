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

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  // Helper: map Stripe price ID to plan name
  // Fetch price IDs from Secret Manager
  const basicMonthlyPriceId = await getSecret('projects/650294800122/secrets/Stripe_Basic_Monthly_PriceID/versions/latest');
  const basicAnnualPriceId = await getSecret('projects/650294800122/secrets/Stripe_Basic_Annual_PriceID/versions/latest');
  const plusMonthlyPriceId = await getSecret('projects/650294800122/secrets/Stripe_Plus_Monthly_PriceID/versions/latest');
  const plusAnnualPriceId = await getSecret('projects/650294800122/secrets/Stripe_Plus_Annual_PriceID/versions/latest');
  function getPlanFromPriceId(priceId) {
    if (priceId === basicMonthlyPriceId) return 'basic';
    if (priceId === plusMonthlyPriceId) return 'plus';
    if (priceId === basicAnnualPriceId) return 'basic_annual';
    if (priceId === plusAnnualPriceId) return 'plus_annual';
    return 'unknown';
  }

  // Fetch Stripe secrets from Secret Manager
  const stripeSecretKey = await getSecret('projects/650294800122/secrets/Stripe_Secret_Key/versions/latest');
  const stripeWebhookSecret = await getSecret('projects/650294800122/secrets/Stripe_Webhook_Key/versions/latest');
  const stripe = require('stripe')(stripeSecretKey);
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata && session.metadata.userId;
    const plan = session.metadata && session.metadata.plan;
    // Save Stripe customerId if missing and update planState as fallback
    if (userId && session.customer) {
      try {
        const userRef = admin.firestore().collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const updates = {};
        if (!userData || !userData.stripeCustomerId) {
          updates.stripeCustomerId = session.customer;
        }
        // Fallback: update planState if not set or still 'free'
        if (plan && plan !== 'free' && (!userData || !userData.planState || userData.planState === 'free')) {
          updates.planState = plan;
        }
        // Fetch card last4 from Stripe and update Firestore
        try {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: session.customer,
            type: 'card',
          });
          if (paymentMethods.data.length > 0) {
            updates.cardLast4 = paymentMethods.data[0].card.last4;
          }
        } catch (err) {
          console.warn('Could not fetch card last4 for customer:', session.customer, err.message);
        }
        if (Object.keys(updates).length > 0) {
          await userRef.update(updates);
          console.log(`Fallback: updated user ${userId} with`, updates);
        }
      } catch (err) {
        console.error('Error saving stripeCustomerId or planState to Firestore:', err);
      }
    }
  }
  // Listen for subscription updated event to keep planState in sync
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    const priceId = subscription.items.data[0]?.price?.id;
    const plan = getPlanFromPriceId(priceId);
    // Find user by stripeCustomerId
    const usersRef = admin.firestore().collection('users');
    const userSnap = await usersRef.where('stripeCustomerId', '==', customerId).get();
    if (!userSnap.empty && plan !== 'unknown') {
      const userDoc = userSnap.docs[0];
      try {
        // Fetch card last4 from Stripe and update Firestore
        let cardLast4 = null;
        try {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
          });
          if (paymentMethods.data.length > 0) {
            cardLast4 = paymentMethods.data[0].card.last4;
          }
        } catch (err) {
          console.warn('Could not fetch card last4 for customer:', customerId, err.message);
        }
        await userDoc.ref.update(cardLast4 ? { planState: plan, cardLast4 } : { planState: plan });
        console.log(`Updated planState to ${plan}${cardLast4 ? ' and cardLast4' : ''} for user ${userDoc.id} on subscription.updated`);
      } catch (err) {
        console.error('Error updating planState on subscription.updated:', err);
      }
    } else if (plan === 'unknown') {
      console.warn('Unknown plan for priceId:', priceId);
    }
  }

  // Listen for subscription deleted event to set planState to 'free'
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    // Find user by stripeCustomerId
    const usersRef = admin.firestore().collection('users');
    const userSnap = await usersRef.where('stripeCustomerId', '==', customerId).get();
    if (!userSnap.empty) {
      const userDoc = userSnap.docs[0];
      try {
        await userDoc.ref.update({ planState: 'free', cardLast4: null });
        console.log(`Updated planState to free and cardLast4 to null for user ${userDoc.id} on subscription.deleted`);
      } catch (err) {
        console.error('Error updating planState to free on subscription deleted:', err);
      }
    }
  }

  res.status(200).send('Received');
});

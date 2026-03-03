const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

async function getSecret(secretName) {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({ name: secretName });
  return version.payload.data.toString();
}

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.createStripePortalSession = functions.https.onRequest(async (req, res) => {
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
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'Missing customerId' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://app.allproperly.com/', // Where to send user after portal
    });
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
      cardLast4 = "xxxx";
      console.warn('Could not fetch card last4 for existing customer:', err.message);
    }
    if (cardLast4) {
      // Find user by stripeCustomerId
      const usersRef = admin.firestore().collection('users');
      const userSnap = await usersRef.where('stripeCustomerId', '==', customerId).get();
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        await userDoc.ref.update({ cardLast4 });
      }
    }
    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal error:', err);
    return res.status(500).json({ error: 'Failed to create portal session' });
  }
});

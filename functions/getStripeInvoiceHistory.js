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

// HTTPS function to get Stripe invoice history for a given customerId
exports.getStripeInvoiceHistory = functions.https.onRequest(async (req, res) => {
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
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'Missing customerId' });
    }
    const stripeSecretKey = await getSecret('projects/650294800122/secrets/Stripe_Secret_Key/versions/latest');
    const stripe = require('stripe')(stripeSecretKey);
    // Fetch latest 10 invoices for the customer
    let invoiceHistory = [];
    try {
      const invoices = await stripe.invoices.list({ customer: customerId, limit: 10 });
      invoiceHistory = invoices.data.map(inv => ({
        id: inv.id,
        amount_paid: inv.amount_paid / 100,
        date: new Date(inv.created * 1000).toISOString(),
        status: inv.status,
        url: inv.hosted_invoice_url || null,
      }));
    } catch (err) {
      console.warn('Could not fetch invoice history:', err.message);
      return res.status(500).json({ error: 'Failed to fetch invoice history from Stripe.' });
    }
    return res.json({ invoice_history: invoiceHistory });
  } catch (err) {
    console.error('getStripeInvoiceHistory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

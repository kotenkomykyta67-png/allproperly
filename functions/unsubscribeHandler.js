const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

exports.unsubscribeHandler = onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const userId = req.query.userId;
  const emailType = req.query.type || 'all'; // 'daily', 'weekly', or 'all'

  if (!userId) {
    res.status(400).send('Missing userId parameter');
    return;
  }

  try {
    // Check if user exists
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      res.status(404).send('User not found');
      return;
    }

    // Update user's email preferences
    const updateData = {};
    
    if (emailType === 'daily') {
      updateData['emailPreferences.dailyEmails'] = false;
    } else if (emailType === 'weekly') {
      updateData['emailPreferences.weeklyEmails'] = false;
    } else {
      // Unsubscribe from all emails
      updateData['emailPreferences.dailyEmails'] = false;
      updateData['emailPreferences.weeklyEmails'] = false;
    }
    
    updateData['emailPreferences.unsubscribedAt'] = admin.firestore.FieldValue.serverTimestamp();

    await userRef.update(updateData);

    console.log(`User ${userId} unsubscribed from ${emailType} emails`);

    // Send simple success response
    const successMessage = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f7fa; }
    .message { background: white; padding: 30px; border-radius: 8px; display: inline-block; }
  </style>
</head>
<body>
  <div class="message">
    <h2>✅ Unsubscribed Successfully</h2>
    <p>You will no longer receive ${emailType === 'all' ? 'AllProperly' : emailType} emails.</p>
    <p><small>You can close this tab now.</small></p>
  </div>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.status(200).send(successMessage);

  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).send('Error processing unsubscribe request');
  }
});
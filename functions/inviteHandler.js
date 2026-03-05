const functions = require('firebase-functions');
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

exports.inviteHandler = functions.https.onRequest(async (req, res) => {
  // Extract inviteId from the URL path
  const pathParts = req.path.split('/');
  // Support both /inviteHandler/invite/{inviteId} and /inviteHandler/{inviteId}
  const inviteId = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
  console.log('Invite link clicked, inviteId:', inviteId);
  try {
    const inviteRef = db.collection('invites').doc(inviteId);
    const inviteDoc = await inviteRef.get();
    if (!inviteDoc.exists) {
      console.error('Invite document not found:', inviteId);
      res.redirect(`https://app.allproperly.com/inviteExpired`);
    }
    console.log('Invite marked as accepted:', inviteId);
    // Redirect to frontend with inviteId so modal can be shown
    res.redirect(`https://app.allproperly.com?inviteId=${inviteId}`);
  } catch (err) {
    console.error('Error updating invite:', err);
    res.status(500).send('Internal server error');
  }
});

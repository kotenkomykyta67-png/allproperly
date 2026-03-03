const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const nodemailer = require('nodemailer');

// Configure the transporter for Postmark
const transporter = nodemailer.createTransport({
  host: 'smtp.postmarkapp.com',
  port: 587,
  auth: {
    user: 'a7ad963f-d207-4efa-aab6-9a3a79e1da7a', // TODO: Replace with your Postmark server token
    pass: 'a7ad963f-d207-4efa-aab6-9a3a79e1da7a'  // TODO: Replace with your Postmark server token
  }
});

exports.sendMail = onDocumentCreated('mail/{mailId}', async (event) => {
  const data = event.data.data();
  try {
    const info = await transporter.sendMail({
      from: 'AllProperly Notifications <notify@allproperly.com>',
      to: data.to,
      subject: data.subject,
      text: data.text,
      html: data.html,
      headers: {
        'X-PM-Message-Stream': 'outbound',
        ...data.headers
      }
    });
    console.log('Email sent:', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
  }
});

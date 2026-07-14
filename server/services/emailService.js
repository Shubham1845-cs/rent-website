const nodemailer = require('nodemailer');

/**
 * createTransport — builds the nodemailer transport from env vars.
 * Supports SMTP (EMAIL_HOST etc.) or Resend (RESEND_API_KEY).
 */
function createTransport() {
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// Option 1: Use Resend's free testing domain
const FROM_ADDRESS = 'onboarding@resend.dev';

// The verified email address that is allowed to receive emails on the free tier
const VERIFIED_TEST_EMAIL = 'gaikwadshubham62173@gmail.com';

/**
 * sendHighScoreAlert — notifies owner when a high-compatibility tenant expresses interest
 */
async function sendHighScoreAlert({ ownerEmail, tenantName, score, listingLocation, interestId }) {
  const transport = createTransport();
  await transport.sendMail({
    from: FROM_ADDRESS,
    to: VERIFIED_TEST_EMAIL, // Hardcoded for Resend free tier
    subject: `(Test to ${ownerEmail}) New high-compatibility interest in your listing`,
    html: `
      <h2>High-Compatibility Interest Alert</h2>
      <p><strong>${tenantName}</strong> has expressed interest in your listing at <strong>${listingLocation}</strong>.</p>
      <p>Compatibility Score: <strong>${score}/100</strong></p>
      <p><a href="${process.env.CLIENT_URL}/dashboard/owner">View Interest Requests</a></p>
      <hr/>
      <p><small>Note: This email was originally intended for ${ownerEmail}.</small></p>
    `,
  });
}

/**
 * sendInterestAccepted — notifies tenant when their interest is accepted
 */
async function sendInterestAccepted({ tenantEmail, ownerName, listingLocation, requestId }) {
  const transport = createTransport();
  await transport.sendMail({
    from: FROM_ADDRESS,
    to: VERIFIED_TEST_EMAIL, // Hardcoded for Resend free tier
    subject: `(Test to ${tenantEmail}) Your interest was accepted`,
    html: `
      <h2>Great news!</h2>
      <p><strong>${ownerName}</strong> has accepted your interest in the listing at <strong>${listingLocation}</strong>.</p>
      <p>You can now chat with the owner: <a href="${process.env.CLIENT_URL}/chat/${requestId}">Start chatting</a></p>
      <hr/>
      <p><small>Note: This email was originally intended for ${tenantEmail}.</small></p>
    `,
  });
}

/**
 * sendInterestDeclined — notifies tenant when their interest is declined
 */
async function sendInterestDeclined({ tenantEmail, ownerName, listingLocation }) {
  const transport = createTransport();
  await transport.sendMail({
    from: FROM_ADDRESS,
    to: VERIFIED_TEST_EMAIL, // Hardcoded for Resend free tier
    subject: `(Test to ${tenantEmail}) Your interest was declined`,
    html: `
      <h2>Interest Update</h2>
      <p><strong>${ownerName}</strong> has declined your interest in the listing at <strong>${listingLocation}</strong>.</p>
      <p>Keep browsing — more listings await! <a href="${process.env.CLIENT_URL}/listings">Browse Listings</a></p>
      <hr/>
      <p><small>Note: This email was originally intended for ${tenantEmail}.</small></p>
    `,
  });
}

module.exports = { sendHighScoreAlert, sendInterestAccepted, sendInterestDeclined };

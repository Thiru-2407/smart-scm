const { OAuth2Client } = require('google-auth-library');

/**
 * Checks whether Google OAuth is configured via environment variables
 */
const isGoogleAuthConfigured = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  return Boolean(clientId && clientId.trim() && clientId.trim() !== 'your_google_client_id_here');
};

/**
 * Verifies a Google ID token cryptographically using google-auth-library
 *
 * @param {string} idToken - The Google ID token issued by Google Identity Services
 * @returns {Promise<Object>} Verified user profile { googleId, email, name, picture, emailVerified }
 */
const verifyGoogleIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Google ID token credential');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !clientId.trim() || clientId.trim() === 'your_google_client_id_here') {
    throw new Error('Google authentication is not configured on the server. Please set GOOGLE_CLIENT_ID in environment.');
  }

  try {
    const client = new OAuth2Client(clientId.trim());
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId.trim()
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid token payload from Google');
    }

    if (!payload.email_verified) {
      throw new Error('Google email address has not been verified');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture || null,
      emailVerified: payload.email_verified
    };
  } catch (error) {
    throw new Error(`Google token verification failed: ${error.message}`);
  }
};

module.exports = {
  isGoogleAuthConfigured,
  verifyGoogleIdToken
};

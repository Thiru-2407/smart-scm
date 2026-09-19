const { OAuth2Client } = require('google-auth-library');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const https = require('https');

// Cache for Firebase public x509 certificates
let cachedCerts = null;
let certsExpiry = 0;

/**
 * Fetch Google's public certificates for Firebase ID token verification
 */
const fetchFirebasePublicCerts = async () => {
  const now = Date.now();
  if (cachedCerts && now < certsExpiry) {
    return cachedCerts;
  }

  return new Promise((resolve, reject) => {
    https.get('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          cachedCerts = JSON.parse(data);
          // Cache for max-age or 1 hour
          const cacheControl = res.headers['cache-control'] || '';
          const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
          const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3600 * 1000;
          certsExpiry = Date.now() + maxAge;
          resolve(cachedCerts);
        } catch (err) {
          reject(new Error('Failed to parse Google public certificates: ' + err.message));
        }
      });
    }).on('error', (err) => {
      reject(new Error('Failed to fetch Google public certificates: ' + err.message));
    });
  });
};

/**
 * Initialize Firebase Admin if service account credentials are provided
 */
let firebaseAdminInitialized = false;
const initFirebaseAdmin = () => {
  if (firebaseAdminInitialized || (admin.apps?.length > 0)) {
    firebaseAdminInitialized = true;
    return true;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccount) {
    try {
      const parsed = JSON.parse(serviceAccount);
      admin.initializeApp({
        credential: admin.credential.cert(parsed)
      });
      firebaseAdminInitialized = true;
      return true;
    } catch (e) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
    }
  }

  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId.trim(),
          clientEmail: clientEmail.trim(),
          privateKey: privateKey.replace(/\\n/g, '\n')
        })
      });
      firebaseAdminInitialized = true;
      return true;
    } catch (e) {
      console.warn('Failed to initialize Firebase Admin SDK:', e.message);
    }
  }

  return false;
};

/**
 * Checks whether Google OAuth / Firebase is configured via environment variables
 */
const isGoogleAuthConfigured = () => {
  const firebaseProj = process.env.FIREBASE_PROJECT_ID;
  if (firebaseProj && firebaseProj.trim() && firebaseProj.trim() !== 'your_firebase_project_id_here') {
    return true;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId && clientId.trim() && clientId.trim() !== 'your_google_client_id_here') {
    return true;
  }

  return false;
};

/**
 * Verifies a Google ID token or Firebase ID token cryptographically
 *
 * @param {string} idToken - The ID token credential
 * @returns {Promise<Object>} Verified user profile { googleId, email, name, picture, emailVerified }
 */
const verifyGoogleIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Google ID token credential');
  }

  if (!isGoogleAuthConfigured()) {
    throw new Error('Google / Firebase authentication is not configured on the server.');
  }

  // 1. Try Firebase Admin SDK if configured
  if (initFirebaseAdmin()) {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (!decoded.email_verified && decoded.email_verified !== undefined) {
        throw new Error('Google email address has not been verified');
      }
      return {
        googleId: decoded.uid || decoded.sub,
        email: (decoded.email || '').toLowerCase(),
        name: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'User'),
        picture: decoded.picture || null,
        emailVerified: Boolean(decoded.email_verified)
      };
    } catch (adminErr) {
      // If admin failed, attempt public key fallback
      console.warn('Firebase Admin verification failed, trying public certs:', adminErr.message);
    }
  }

  // 2. Try Firebase ID Token verification via Google's public x509 certs
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
  if (firebaseProjectId && firebaseProjectId.trim() && firebaseProjectId.trim() !== 'your_firebase_project_id_here') {
    try {
      const decodedHeader = jwt.decode(idToken, { complete: true });
      if (decodedHeader && decodedHeader.header && decodedHeader.header.kid) {
        const certs = await fetchFirebasePublicCerts();
        const cert = certs[decodedHeader.header.kid];
        if (cert) {
          const verifiedPayload = jwt.verify(idToken, cert, {
            algorithms: ['RS256'],
            audience: firebaseProjectId.trim(),
            issuer: 'https://securetoken.google.com/' + firebaseProjectId.trim()
          });

          if (!verifiedPayload.email_verified && verifiedPayload.email_verified !== undefined) {
            throw new Error('Google email address has not been verified');
          }

          return {
            googleId: verifiedPayload.user_id || verifiedPayload.sub,
            email: (verifiedPayload.email || '').toLowerCase(),
            name: verifiedPayload.name || (verifiedPayload.email ? verifiedPayload.email.split('@')[0] : 'User'),
            picture: verifiedPayload.picture || null,
            emailVerified: Boolean(verifiedPayload.email_verified)
          };
        }
      }
    } catch (fbCertErr) {
      console.warn('Firebase cert verification attempt error:', fbCertErr.message);
    }
  }

  // 3. Fallback: Standard Google OAuth Client verification
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (googleClientId && googleClientId.trim() && googleClientId.trim() !== 'your_google_client_id_here') {
    try {
      const client = new OAuth2Client(googleClientId.trim());
      const ticket = await client.verifyIdToken({
        idToken,
        audience: googleClientId.trim()
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
    } catch (clientErr) {
      throw new Error('Google token verification failed: ' + clientErr.message);
    }
  }

  throw new Error('Google token verification failed: invalid or unverified token');
};

module.exports = {
  isGoogleAuthConfigured,
  verifyGoogleIdToken
};

import { useState } from 'react';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase';
import { signInWithPopup } from 'firebase/auth';

/**
 * Google SVG Logo Component
 */
export const GoogleLogo = () => (
  <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.86c2.26-2.09 3.68-5.17 3.68-9.09z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.34 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

/**
 * GoogleSignInButton Component
 * Supports Firebase Authentication (Google Provider) with automatic graceful fallback
 * when Firebase environment variables are not configured.
 */
const GoogleSignInButton = ({ onGoogleSuccess, onError, text = 'Continue with Google', disabled = false }) => {
  const [loading, setLoading] = useState(false);
  const isConfigured = isFirebaseConfigured();

  const handleGoogleClick = async () => {
    if (!isConfigured) return;

    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      if (result && result.user) {
        const idToken = await result.user.getIdToken();
        await onGoogleSuccess(idToken);
      }
    } catch (err) {
      // Don't show error if user simply closed the popup
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        if (onError) {
          onError(err.message || 'Google sign-in failed');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // If Firebase is configured, render active, clickable Google button
  if (isConfigured) {
    return (
      <div className="google-signin-wrapper">
        <button
          type="button"
          id="btn-google-signin"
          className="btn-google"
          onClick={handleGoogleClick}
          disabled={disabled || loading}
        >
          <GoogleLogo />
          <span>{loading ? 'Signing in with Google...' : text}</span>
        </button>
      </div>
    );
  }

  // Clearly disabled / unavailable state when OAuth is unconfigured
  return (
    <div className="google-signin-wrapper">
      <button
        type="button"
        id="btn-google-signin"
        className="btn-google btn-google-disabled"
        disabled={true}
        aria-disabled="true"
        title="Google authentication is not configured in this environment"
      >
        <GoogleLogo />
        <span>Continue with Google (Not Configured)</span>
      </button>
      <p className="google-unconfigured-note">
        Google OAuth is not configured in this environment.
      </p>
    </div>
  );
};

export default GoogleSignInButton;

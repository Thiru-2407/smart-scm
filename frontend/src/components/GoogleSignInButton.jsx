import { useEffect, useRef, useState } from 'react';
import { authService } from '../services/api';

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
 * Supports Google Identity Services (GIS) with automatic graceful fallback
 * when VITE_GOOGLE_CLIENT_ID or backend GOOGLE_CLIENT_ID is not configured.
 */
const GoogleSignInButton = ({ onGoogleSuccess, onError, text = 'Continue with Google', disabled = false }) => {
  const [clientId, setClientId] = useState(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || null
  );
  const [gisLoaded, setGisLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const googleButtonRef = useRef(null);

  // Check backend auth config if frontend env is not set
  useEffect(() => {
    let isMounted = true;
    if (!clientId) {
      authService.getAuthConfig()
        .then((res) => {
          if (isMounted && res.googleAuthEnabled && res.clientId) {
            setClientId(res.clientId);
          }
        })
        .catch(() => {
          // Backend may be offline or config unavailable; fallback button will remain
        });
    }
    return () => {
      isMounted = false;
    };
  }, [clientId]);

  // Load Google Identity Services script if clientId is available
  useEffect(() => {
    if (!clientId) return;

    if (window.google?.accounts?.id) {
      setGisLoaded(true);
      return;
    }

    const scriptId = 'google-identity-services-script';
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => setGisLoaded(true);
      script.onerror = () => {
        console.warn('Google Identity Services script could not be loaded.');
      };
      document.body.appendChild(script);
    } else {
      script.addEventListener('load', () => setGisLoaded(true));
    }
  }, [clientId]);

  // Render official Google button if GIS is loaded and clientId is available
  useEffect(() => {
    if (clientId && gisLoaded && window.google?.accounts?.id && googleButtonRef.current) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (response.credential) {
              try {
                setLoading(true);
                await onGoogleSuccess(response.credential);
              } catch (err) {
                if (onError) {
                  onError(err.message || 'Google sign-in failed');
                }
              } finally {
                setLoading(false);
              }
            }
          }
        });

        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 380
        });
      } catch (err) {
        console.warn('Failed to render Google Identity Services button:', err);
      }
    }
  }, [clientId, gisLoaded, onGoogleSuccess, onError]);

  // Fallback click handler if not disabled
  const handleFallbackClick = () => {
    if (!clientId) {
      if (onError) {
        onError('Google authentication is not configured in this environment. Set VITE_GOOGLE_CLIENT_ID to enable Google Sign-In.');
      }
    } else if (!gisLoaded) {
      if (onError) {
        onError('Google Sign-In service is loading or unreachable. Please try again.');
      }
    }
  };

  if (clientId && gisLoaded) {
    return (
      <div className="google-signin-wrapper">
        <div ref={googleButtonRef} className="google-btn-container" />
        {loading && <p className="google-signin-status">Signing in with Google...</p>}
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
        onClick={handleFallbackClick}
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

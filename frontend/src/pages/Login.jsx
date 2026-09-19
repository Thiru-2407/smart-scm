import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const getFriendlyErrorMessage = (error) => {
    if (!error) return '';
    const msg = typeof error === 'string' ? error : error.message || '';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Unable to connect')) {
      return 'Backend unavailable. Please ensure the server is running.';
    }
    if (msg.toLowerCase().includes('google authentication is not configured')) {
      return 'Google authentication is not configured. Please set GOOGLE_CLIENT_ID on the server or VITE_GOOGLE_CLIENT_ID in the client.';
    }
    if (msg.toLowerCase().includes('google') && msg.toLowerCase().includes('failed')) {
      return 'Google sign-in failed. Please try again.';
    }
    if (msg.toLowerCase().includes('invalid credential') || msg.toLowerCase().includes('password') || msg.toLowerCase().includes('email')) {
      return 'Invalid credentials. Please check your email and password.';
    }
    return msg || 'Authentication failed. Please try again.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Form validation
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credential) => {
    setErrorMessage('');
    try {
      setIsSubmitting(true);
      await googleLogin(credential);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-badge">Smart SCM</div>
          <h2>Smart SCM</h2>
          <p>Software Configuration Management</p>
        </div>

        {errorMessage && (
          <div className="alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="e.g. lead@smartscm.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            id="btn-login-submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="btn-loading">
                <span className="spinner-small"></span> Authenticating...
              </span>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <GoogleSignInButton
          onGoogleSuccess={handleGoogleSuccess}
          onError={(msg) => setErrorMessage(getFriendlyErrorMessage(msg))}
          disabled={isSubmitting}
          text="Continue with Google"
        />

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, googleLogin } = useAuth();
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
    return msg || 'Registration failed. Please try again.';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const { name, email, password, confirmPassword } = formData;

    // Validation
    if (!name.trim()) {
      setErrorMessage('Please provide your full name.');
      return;
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter a password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-type your password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register(name.trim(), email.trim(), password);
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
          <h2>Create Your Account</h2>
          <p>Register as a team member in configuration management</p>
        </div>

        {errorMessage && (
          <div className="alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              type="text"
              name="name"
              placeholder="e.g. Alex Mercer"
              value={formData.name}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              type="email"
              name="email"
              placeholder="e.g. alex@smartscm.io"
              value={formData.email}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              name="password"
              placeholder="Minimum 6 characters"
              value={formData.password}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-confirm-password">Confirm Password</label>
            <input
              id="reg-confirm-password"
              type="password"
              name="confirmPassword"
              placeholder="Repeat your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            id="btn-register-submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="btn-loading">
                <span className="spinner-small"></span> Creating Account...
              </span>
            ) : (
              'Create Account'
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
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;

import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('smart_scm_token'));
  const [loading, setLoading] = useState(true);

  // Restore authentication state on initial mount or page refresh
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('smart_scm_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await authService.getCurrentUser();
        if (response.success && response.user) {
          setUser(response.user);
        } else {
          // Token is invalid/expired
          localStorage.removeItem('smart_scm_token');
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to restore session:', error.message);
        localStorage.removeItem('smart_scm_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Login handler
  const login = async (email, password) => {
    const response = await authService.login(email, password);
    if (response.success && response.token) {
      localStorage.setItem('smart_scm_token', response.token);
      setToken(response.token);
      setUser(response.user);
    }
    return response;
  };

  // Registration handler
  const register = async (name, email, password, role) => {
    const response = await authService.register(name, email, password, role);
    if (response.success && response.token) {
      localStorage.setItem('smart_scm_token', response.token);
      setToken(response.token);
      setUser(response.user);
    }
    return response;
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('smart_scm_token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

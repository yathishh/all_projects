import { createContext, useState, useContext, useEffect } from 'react';
import { api } from '@/api/apiClient';

const AuthContext = createContext(/** @type {any} */ (undefined));

/** @param {{ children: import('react').ReactNode }} props */
export const AuthProvider = ({ children }) => {
  const [user, setUser]                   = useState(/** @type {object|null} */ (null));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setIsLoadingAuth(false);
      return;
    }
    api.get('/auth/me')
      .then(({ user: u }) => {
        setUser(u);
        setIsAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem('auth_token');
      })
      .finally(() => setIsLoadingAuth(false));
  }, []);

  const logout = (shouldRedirect = true) => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) window.location.href = '/login';
  };

  const navigateToLogin = () => { window.location.href = '/login'; };

  const checkUserAuth = async () => {
    try {
      const { user: u } = await api.get('/auth/me');
      setUser(u);
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      authChecked: !isLoadingAuth,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: async () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

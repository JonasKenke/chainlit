import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@chainlit/react-client';

import { AUTH_REDIRECT_STORAGE_KEY } from './Login';

const getSafeRedirect = () => {
  const redirect = sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
  return redirect?.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/';
};

export default function AuthCallback() {
  const { user, setUserFromAPI } = useAuth();
  const navigate = useNavigate();

  // Fetch user in cookie-based oauth.
  useEffect(() => {
    if (!user) setUserFromAPI();
  }, []);

  useEffect(() => {
    if (user) {
      navigate(getSafeRedirect());
    }
  }, [user, navigate]);

  return null;
}

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const GoogleOAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [message, setMessage] = useState('Đang đăng nhập với Google...');

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    if (error) {
      setMessage(`Đăng nhập Google thất bại: ${error}`);
      const timer = window.setTimeout(() => navigate('/login', { replace: true }), 1400);
      return () => window.clearTimeout(timer);
    }
    if (!token) {
      setMessage('Thiếu token đăng nhập từ Google.');
      const timer = window.setTimeout(() => navigate('/login', { replace: true }), 1400);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    loginWithToken(token)
      .then(() => {
        if (!cancelled) navigate('/', { replace: true });
      })
      .catch(() => {
        if (!cancelled) {
          setMessage('Không thể hoàn tất đăng nhập Google.');
          window.setTimeout(() => navigate('/login', { replace: true }), 1400);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loginWithToken, navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-primary/20 bg-white dark:bg-primary/5 p-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Google OAuth</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
      </div>
    </div>
  );
};

export default GoogleOAuthCallbackPage;

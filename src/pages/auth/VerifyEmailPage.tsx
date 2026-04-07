import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as backend from '@/services/backend';

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!token.trim()) {
      setStatus('err');
      setMessage('Thiếu liên kết xác minh. Kiểm tra lại email hoặc yêu cầu gửi lại từ trang hồ sơ.');
      return;
    }
    setStatus('loading');
    void backend
      .verifyEmail(token.trim())
      .then((res) => {
        setStatus('ok');
        setMessage(res.message ?? 'Email đã được xác minh.');
      })
      .catch((err: Error) => {
        setStatus('err');
        setMessage(err.message ?? 'Xác minh thất bại.');
      });
  }, [token]);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Xác minh email</h1>
        {status === 'loading' && <p className="text-slate-600 dark:text-slate-400">Đang xác minh…</p>}
        {status === 'ok' && (
          <p className="text-emerald-700 dark:text-emerald-300 text-sm">{message}</p>
        )}
        {status === 'err' && <p className="text-red-600 dark:text-red-400 text-sm">{message}</p>}
        <div className="mt-6">
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            Đăng nhập
          </Link>
          {' · '}
          <Link to="/profile" className="text-sm font-medium text-primary hover:underline">
            Hồ sơ
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;

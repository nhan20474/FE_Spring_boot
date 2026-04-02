import React, { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import * as backend from '@/services/backend';

const ResetPasswordPage: React.FC = () => {
  const { token: tokenFromPath } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = tokenFromPath ?? searchParams.get('token') ?? '';

  const [token, setToken] = useState(tokenFromUrl);
  useEffect(() => {
    setToken(tokenFromUrl);
  }, [tokenFromUrl]);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError('Mật khẩu mới cần ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirm) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    setLoading(true);
    void backend
      .resetPassword(token.trim(), newPassword)
      .then(() => setDone(true))
      .catch((err: Error) => setError(err.message ?? 'Đặt lại mật khẩu thất bại'))
      .finally(() => setLoading(false));
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background-light dark:bg-background-dark">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">Đã đặt lại mật khẩu thành công.</p>
          <Link to="/login" className="mt-4 inline-block text-primary font-medium hover:underline">
            Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background-light dark:bg-background-dark">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Đặt lại mật khẩu</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Nhập token từ email / bước quên mật khẩu và mật khẩu mới.</p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="rst-token" className="block text-sm font-medium mb-1">
              Token
            </label>
            <input
              id="rst-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono"
              placeholder="UUID…"
              required
            />
          </div>
          <div>
            <label htmlFor="rst-pw" className="block text-sm font-medium mb-1">
              Mật khẩu mới
            </label>
            <input
              id="rst-pw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              required
              minLength={6}
            />
          </div>
          <div>
            <label htmlFor="rst-pw2" className="block text-sm font-medium mb-1">
              Xác nhận mật khẩu
            </label>
            <input
              id="rst-pw2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-blue-600 disabled:opacity-60 text-white font-semibold py-3 rounded-lg"
          >
            {loading ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-primary hover:underline">
            ← Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

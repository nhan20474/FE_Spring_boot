import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as backend from '@/services/backend';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    message?: string;
    resetToken?: string;
    expiresInSeconds?: number;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    void backend
      .forgotPassword(email.trim())
      .then((res) => {
        setSuccess({
          message: res.message,
          resetToken: res.resetToken,
          expiresInSeconds: res.expiresInSeconds,
        });
      })
      .catch((err: Error) => setError(err.message ?? 'Gửi yêu cầu thất bại'))
      .finally(() => setLoading(false));
  };

  const resetHref =
    success?.resetToken != null
      ? `#/reset-password/${encodeURIComponent(success.resetToken)}`
      : '#/reset-password';

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Quên mật khẩu</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Nhập email đã đăng ký. Nếu email tồn tại, bạn sẽ nhận hướng dẫn đặt lại mật khẩu qua email. Khi backend bật chế độ dev, liên kết có thể hiển thị ngay bên dưới.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="fp-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              id="fp-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm"
              placeholder="you@example.com"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-900 dark:text-emerald-100">
              <p>{success.message ?? 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.'}</p>
              <p className="mt-2 text-xs opacity-90">Kiểm tra hộp thư (và thư mục spam).</p>
              {success.resetToken && (
                <p className="mt-2">
                  <span className="block text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                    Chế độ dev: liên kết đặt lại mật khẩu
                  </span>
                  <a href={resetHref} className="font-semibold underline text-primary">
                    Đặt lại mật khẩu ngay
                  </a>
                  {success.expiresInSeconds != null && (
                    <span className="block mt-1 text-xs opacity-90">Token hết hạn sau khoảng {success.expiresInSeconds}s.</span>
                  )}
                </p>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-blue-600 disabled:opacity-60 text-white font-semibold py-3 rounded-lg"
          >
            {loading ? 'Đang gửi…' : 'Gửi yêu cầu'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            ← Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

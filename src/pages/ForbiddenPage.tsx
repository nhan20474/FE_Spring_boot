import React from 'react';
import { Link } from 'react-router-dom';

const ForbiddenPage: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
    <p className="text-7xl font-black text-slate-200 dark:text-slate-800 select-none" aria-hidden>
      403
    </p>
    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">Không có quyền truy cập</h1>
    <p className="text-slate-500 dark:text-slate-400 mt-2 text-center max-w-md">
      Bạn cần quyền phù hợp để xem trang này. Nếu bạn là khách hàng, hãy quay lại cửa hàng.
    </p>
    <div className="flex flex-wrap gap-4 mt-8 justify-center">
      <Link to="/" className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-opacity">
        Về trang chủ
      </Link>
      <Link
        to="/login"
        className="px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        Đăng nhập
      </Link>
    </div>
  </div>
);

export default ForbiddenPage;

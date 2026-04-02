import React, { useCallback, useEffect, useState } from 'react';
import * as backend from '@/services/backend';
import type { AdminUserDto } from '@/types/api';

const UserListPage: React.FC = () => {
  const [items, setItems] = useState<AdminUserDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const size = 15;

  const load = useCallback(() => {
    setLoading(true);
    void backend
      .adminGetUsers({ q: appliedQ.trim() || undefined, page, size, sortBy: 'createdAt', sortDir: 'desc' })
      .then((res) => {
        setItems(res.items);
        setTotal(res.totalElements);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Lỗi tải'))
      .finally(() => setLoading(false));
  }, [page, appliedQ]);

  useEffect(() => {
    load();
  }, [load]);

  const applySearch = () => {
    setAppliedQ(searchInput.trim());
    setPage(0);
  };

  const changeRole = async (user: AdminUserDto, role: 'admin' | 'customer') => {
    if (user.role === role) return;
    if (!window.confirm(`Đổi vai trò ${user.email} → ${role}?`)) return;
    try {
      await backend.adminUpdateUserRole(user.id, role);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi');
    }
  };

  const remove = async (user: AdminUserDto) => {
    if (!window.confirm(`Xóa vĩnh viễn người dùng ${user.email}?`)) return;
    try {
      await backend.adminDeleteUser(user.id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Người dùng</h1>
        <p className="text-sm text-slate-600 mt-1">Danh sách tài khoản — đổi vai trò / xóa (cẩn trọng).</p>
      </header>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="block">
          <span className="text-xs font-bold text-slate-600">Tìm theo email/tên</span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applySearch();
            }}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[220px]"
            placeholder="email…"
          />
        </label>
        <button type="button" onClick={applySearch} className="rounded-xl bg-slate-900 text-white font-semibold px-4 py-2 text-sm">
          Tìm
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <p className="p-6 text-slate-500">Đang tải…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Tên</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-mono">{u.id}</td>
                    <td className="px-4 py-3">{u.name}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={(u.role ?? 'customer') === 'admin' ? 'admin' : 'customer'}
                        onChange={(e) => void changeRole(u, e.target.value as 'admin' | 'customer')}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      >
                        <option value="customer">customer</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void remove(u)}
                        className="text-red-600 font-medium text-xs hover:underline"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p className="p-6 text-slate-500">Không có bản ghi.</p>}
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-100 flex justify-between items-center text-sm">
          <span className="text-slate-600">
            Trang {page + 1} / {totalPages} — {total} người
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default UserListPage;

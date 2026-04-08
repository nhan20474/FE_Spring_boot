/** Chuẩn hóa role từ API/JWT (admin, ADMIN, …) → admin | customer */
export function normalizeRole(role: string | undefined | null): 'admin' | 'customer' {
  const r = String(role ?? '')
    .trim()
    .toLowerCase();
  if (r === 'admin') return 'admin';
  return 'customer';
}

export function isAdminRole(role: string | undefined | null): boolean {
  return normalizeRole(role) === 'admin';
}

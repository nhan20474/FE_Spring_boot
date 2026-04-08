import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { getChatHistory, getChatStatus, postChatMessage } from '@/services/backend';

type ChatLine = { id: string; role: 'user' | 'assistant'; text: string; sentAt?: string };

const SupportChatWidget: React.FC = () => {
  const location = useLocation();
  const { user, isAuthenticated, isInitialized } = useAuth();
  const formatSentTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [lastReadAtMs, setLastReadAtMs] = useState<number>(Date.now());
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hideOnAdmin = location.pathname.startsWith('/admin');
  const isAdminUser = (user?.role ?? '').toLowerCase() === 'admin';
  const unreadCount = lines.filter((l) => {
    if (l.role !== 'assistant') return false;
    const t = l.sentAt ? new Date(l.sentAt).getTime() : 0;
    return t > lastReadAtMs;
  }).length;
  const messageBadge = unreadCount > 5 ? '5+' : String(unreadCount);

  const loadStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setAvailable(null);
      return;
    }
    try {
      const s = await getChatStatus();
      setAvailable(Boolean(s.available));
    } catch {
      setAvailable(false);
    }
  }, [isAuthenticated]);

  // Đồng bộ lịch sử chat từ DB (dùng cho mở chat + polling nền)
  const syncHistory = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { messages } = await getChatHistory(50);
      setLines(
        messages.map((m) => ({
          id: String(m.id),
          role: m.role,
          text: m.content,
          sentAt: m.sentAt,
        }))
      );
    } catch {
      // Lỗi đồng bộ nền không cản UI
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated || !open) return;
    setLastReadAtMs(Date.now());
    void loadStatus();
    void syncHistory();
  }, [isInitialized, isAuthenticated, open, loadStatus, syncHistory]);

  // Polling nền để nhận tin mới từ admin khi đang đóng chat
  useEffect(() => {
    if (!isInitialized || !isAuthenticated || isAdminUser) return;
    const timer = window.setInterval(() => {
      void syncHistory();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isInitialized, isAuthenticated, isAdminUser, syncHistory]);

  // Reset lịch sử khi user đăng xuất
  useEffect(() => {
    if (!isAuthenticated) {
      setLines([]);
      setLastReadAtMs(Date.now());
    }
  }, [isAuthenticated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError(null);
    const uid = `u-${Date.now()}`;
    setLines((prev) => [...prev, { id: uid, role: 'user', text, sentAt: new Date().toISOString() }]);
    setSending(true);
    try {
      const { reply } = await postChatMessage(text);
      setLines((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: reply, sentAt: new Date().toISOString() },
      ]);
    } catch (e) {
      setLines((prev) => prev.filter((l) => l.id !== uid));
      setInput(text);
      setError(e instanceof ApiError ? e.message : 'Không gửi được tin nhắn.');
    } finally {
      setSending(false);
    }
  };

  if (!isInitialized || hideOnAdmin) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[300] flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div className="w-[min(100vw-2rem,380px)] h-[min(70vh,480px)] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-primary text-white">
            <div>
              <p className="font-bold text-sm">Chat với Admin TechHome</p>
              <p className="text-[11px] text-white/80">Trao đổi trực tiếp với quản trị viên</p>
              {isAuthenticated && (
                <p className="text-[11px] text-white/90 mt-0.5">
                  {isAdminUser
                    ? 'Bạn đang đăng nhập bằng tài khoản quản trị viên'
                    : `Cuộc trò chuyện: ${user?.name ?? 'Bạn'} ↔ Admin`}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-white/15"
              aria-label="Đóng chat"
            >
              <span className="material-icons text-xl">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {!isAuthenticated ? (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-4 text-slate-600 dark:text-slate-300">
                <p className="mb-3">Đăng nhập để nhắn tin với admin hỗ trợ.</p>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90"
                  onClick={() => setOpen(false)}
                >
                  Đăng nhập
                </Link>
              </div>
            ) : isAdminUser ? (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-800 dark:text-amber-200">
                <p className="text-sm font-semibold">Bạn đang ở vai trò Admin</p>
                <p className="text-xs mt-1">
                  Khung này dành cho khách hàng nhắn hỗ trợ. Vui lòng vào trang quản trị để xử lý hội thoại.
                </p>
                <Link
                  to="/admin/inbox"
                  className="inline-flex mt-2 text-xs font-semibold text-primary hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Mở Inbox quản trị
                </Link>
              </div>
            ) : available === false ? (
              <p className="text-slate-500 dark:text-slate-400 p-2">
                Kênh chat tạm thời chưa khả dụng. Vui lòng thử lại sau hoặc liên hệ admin.
              </p>
            ) : (
              <>
                {lines.length === 0 && (
                  <p className="text-slate-500 dark:text-slate-400 text-xs px-1">
                    Xin chào! Bạn cần admin hỗ trợ gì về đơn hàng hay sản phẩm?
                  </p>
                )}
                {lines.map((l) => (
                  <div
                    key={l.id}
                    className={`flex ${l.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {l.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 flex-shrink-0 self-end">
                        <span className="material-icons text-primary text-base">support_agent</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2 whitespace-pre-wrap break-words ${
                        l.role === 'user'
                          ? 'bg-primary text-white rounded-br-md'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-md'
                      }`}
                    >
                      <p
                        className={`text-[10px] mb-1 ${
                          l.role === 'user' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {l.role === 'user' ? user?.name ?? 'Bạn' : 'Admin'}
                        {l.sentAt ? ` · ${formatSentTime(l.sentAt)}` : ''}
                      </p>
                      {l.text}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 flex-shrink-0 self-end">
                      <span className="material-icons text-primary text-base">support_agent</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
            {error && <p className="text-red-600 dark:text-red-400 text-xs px-1">{error}</p>}
          </div>

          {isAuthenticated && available !== false && !isAdminUser && (
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void send()}
                placeholder="Nhập tin nhắn cho admin..."
                disabled={sending}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
              <button
                type="button"
                disabled={sending || !input.trim()}
                onClick={() => void send()}
                className="px-3 py-2 rounded-xl bg-primary text-white disabled:opacity-50"
                aria-label="Gửi"
              >
                <span className="material-icons text-xl">send</span>
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
        aria-label={open ? 'Đóng chat hỗ trợ' : 'Mở chat với admin'}
      >
        <span className="material-icons text-2xl">{open ? 'close' : 'support_agent'}</span>
        {!open && isAuthenticated && !isAdminUser && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold leading-5 text-center border-2 border-white">
            {messageBadge}
          </span>
        )}
      </button>
    </div>
  );
};

export default SupportChatWidget;

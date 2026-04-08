import React, { useEffect, useMemo, useState } from 'react';
import { adminGetChatConversations, adminGetChatMessages, adminReplyChatMessage } from '@/services/backend';
import type { AdminChatConversationDto, ChatMessageDto } from '@/types/api';
import { formatDate } from '@/utils/formatDate';

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES = 150;

const InboxPage: React.FC = () => {
  const [conversations, setConversations] = useState<AdminChatConversationDto[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [activeUser, setActiveUser] = useState<{ id: number; name: string; email: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = async (keepActive = true) => {
    const res = await adminGetChatConversations(MAX_CONVERSATIONS);
    const items = res.items ?? [];
    setConversations(items);
    if (!keepActive || activeUserId == null) {
      setActiveUserId(items.length > 0 ? items[0].userId : null);
      return;
    }
    const exists = items.some((x) => x.userId === activeUserId);
    if (!exists) setActiveUserId(items.length > 0 ? items[0].userId : null);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadConversations(false);
      } catch {
        if (!cancelled) {
          setError('Không tải được danh sách cuộc trò chuyện.');
          setConversations([]);
          setActiveUserId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeUserId) {
      setActiveUser(null);
      setMessages([]);
      return;
    }
    let cancelled = false;
    const loadMessages = async () => {
      setMessageLoading(true);
      try {
        const res = await adminGetChatMessages(activeUserId, MAX_MESSAGES);
        if (!cancelled) {
          setActiveUser(res.user);
          setMessages(res.messages ?? []);
        }
      } catch {
        if (!cancelled) setError('Không tải được hội thoại.');
      } finally {
        if (!cancelled) setMessageLoading(false);
      }
    };
    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [activeUserId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadConversations(true);
      if (activeUserId) {
        void adminGetChatMessages(activeUserId, MAX_MESSAGES).then((res) => {
          setActiveUser(res.user);
          setMessages(res.messages ?? []);
        });
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeUserId]);

  const customerWaitingCount = useMemo(
    () => conversations.filter((c) => c.lastRole === 'user').length,
    [conversations],
  );

  const sendReply = async () => {
    const text = reply.trim();
    if (!activeUserId || !text || sending) return;
    setSending(true);
    setError(null);
    try {
      const sent = await adminReplyChatMessage(activeUserId, text);
      setMessages((prev) => [...prev, sent]);
      setReply('');
      await loadConversations(true);
    } catch {
      setError('Không gửi được phản hồi cho khách hàng.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[30px] leading-[40px] font-semibold tracking-tight text-[#202224]">Inbox</h1>
          <p className="text-sm text-slate-500 mt-1">Trò chuyện với khách hàng theo thời gian thực</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-sm font-semibold">
            {customerWaitingCount} khách đang chờ
          </span>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[640px] grid grid-cols-1 lg:grid-cols-[320px_1fr]">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Đang tải hội thoại...</div>
        ) : error ? (
          <div className="p-8 text-sm text-red-600">{error}</div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">Chưa có cuộc trò chuyện nào.</div>
        ) : (
          <>
            <aside className="border-r border-slate-200 max-h-[640px] overflow-y-auto">
              <ul className="divide-y divide-slate-100">
                {conversations.map((c) => (
                  <li key={c.userId}>
                    <button
                      type="button"
                      onClick={() => setActiveUserId(c.userId)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${
                        c.userId === activeUserId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{c.userName}</p>
                        {c.lastRole === 'user' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            chờ trả lời
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{c.userEmail}</p>
                      <p className="text-xs text-slate-600 mt-1 truncate">{c.lastMessage}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {formatDate(c.lastSentAt, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="flex flex-col min-h-[640px]">
              <div className="px-5 py-4 border-b border-slate-100">
                {activeUser ? (
                  <>
                    <p className="text-sm font-semibold text-slate-800">{activeUser.name}</p>
                    <p className="text-xs text-slate-500">{activeUser.email}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Chọn một cuộc trò chuyện để bắt đầu</p>
                )}
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[500px]">
                {messageLoading ? (
                  <p className="text-sm text-slate-500">Đang tải tin nhắn...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có tin nhắn.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === 'assistant' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                          m.role === 'assistant'
                            ? 'bg-primary text-white rounded-br-md'
                            : 'bg-slate-100 text-slate-800 rounded-bl-md'
                        }`}
                      >
                        <p className={`text-[10px] mb-1 ${m.role === 'assistant' ? 'text-white/80' : 'text-slate-500'}`}>
                          {m.role === 'assistant' ? 'Admin' : activeUser?.name ?? 'Khách hàng'} ·{' '}
                          {formatDate(m.sentAt, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void sendReply()}
                  placeholder={activeUserId ? 'Nhập phản hồi cho khách hàng...' : 'Chọn cuộc trò chuyện trước'}
                  disabled={!activeUserId || sending}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={!activeUserId || sending || !reply.trim()}
                  className="px-4 py-2 rounded-xl bg-primary text-white disabled:opacity-50 text-sm font-semibold"
                >
                  Gửi
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default InboxPage;

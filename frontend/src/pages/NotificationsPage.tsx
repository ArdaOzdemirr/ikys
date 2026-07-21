import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import {
  Bell, CheckCheck, Send, Inbox, CalendarCheck, CalendarX, Clock,
  MessageSquare, Trash2, Reply,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NotificationItem {
  id: string;
  type: 'LEAVE_APPROVAL_PENDING' | 'LEAVE_APPROVED' | 'LEAVE_REJECTED' | 'MESSAGE';
  priority?: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
  sender?: { id: string; firstName: string; lastName: string } | null;
}

interface Recipient {
  id: string;
  firstName: string;
  lastName: string;
  position?: string | null;
  department?: string | null;
}

type ReplyTo = { id: string; name: string; notificationId: string } | null;

const typeMeta: Record<NotificationItem['type'], { icon: any; color: string; bg: string }> = {
  LEAVE_APPROVAL_PENDING: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  LEAVE_APPROVED: { icon: CalendarCheck, color: 'text-green-600', bg: 'bg-green-50' },
  LEAVE_REJECTED: { icon: CalendarX, color: 'text-red-600', bg: 'bg-red-50' },
  MESSAGE: { icon: MessageSquare, color: 'text-brand-600', bg: 'bg-brand-50' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR');
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'inbox' | 'compose'>('inbox');
  const [replyTo, setReplyTo] = useState<ReplyTo>(null);

  const { data: items } = useQuery<NotificationItem[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications'),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notif-unread'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidate,
  });

  const markAll = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => { toast.success('Tümü okundu işaretlendi'); invalidate(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: invalidate,
  });

  const unreadCount = items?.filter((n) => !n.isRead).length ?? 0;

  const startReply = (n: NotificationItem) => {
    if (!n.sender) return;
    setReplyTo({ id: n.sender.id, name: `${n.sender.firstName} ${n.sender.lastName}`, notificationId: n.id });
    setTab('compose');
  };

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Bildirimler</h1>
        </div>
        {tab === 'inbox' && unreadCount > 0 && (
          <button onClick={() => markAll.mutate()} className="btn-secondary flex items-center gap-1 text-sm">
            <CheckCheck size={16} /> Tümünü okundu yap
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('inbox')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
            tab === 'inbox' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Inbox size={16} /> Gelen Kutusu
          {unreadCount > 0 && <span className="badge bg-red-100 text-red-700">{unreadCount}</span>}
        </button>
        <button
          onClick={() => { setReplyTo(null); setTab('compose'); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
            tab === 'compose' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Send size={16} /> Mesaj Gönder
        </button>
      </div>

      {tab === 'inbox' ? (
        <InboxList
          items={items}
          onRead={(id) => markRead.mutate(id)}
          onDelete={(id) => remove.mutate(id)}
          onReply={startReply}
        />
      ) : (
        <ComposeMessage replyTo={replyTo} onSent={() => { setReplyTo(null); setTab('inbox'); }} />
      )}
    </div>
  );
}

function InboxList({
  items, onRead, onDelete, onReply,
}: {
  items?: NotificationItem[];
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (n: NotificationItem) => void;
}) {
  if (!items) return <p className="text-gray-500">Yükleniyor...</p>;
  if (items.length === 0) {
    return (
      <div className="card text-center py-12">
        <Inbox className="mx-auto text-gray-400 mb-2" size={32} />
        <p className="text-gray-600">Henüz bildiriminiz yok</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((n) => {
        const meta = typeMeta[n.type] ?? typeMeta.MESSAGE;
        const Icon = meta.icon;
        const urgent = n.priority === 'URGENT';
        const important = n.priority === 'IMPORTANT';
        const cardCls = urgent
          ? 'border-2 border-red-400 bg-red-50'
          : important
          ? 'border border-amber-300 bg-amber-50'
          : n.isRead
          ? 'opacity-70'
          : 'ring-1 ring-brand-100';
        return (
          <div
            key={n.id}
            className={`card !p-4 flex gap-3 transition ${cardCls}`}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
              <Icon size={18} className={meta.color} />
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !n.isRead && onRead(n.id)}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  {urgent && <span className="badge bg-red-600 text-white">ÇOK ÖNEMLİ</span>}
                  {important && <span className="badge bg-amber-500 text-white">ÖNEMLİ</span>}
                  {n.title}
                </p>
                <span className="text-xs text-gray-400 shrink-0">{timeAgo(n.createdAt)}</span>
              </div>
              {n.body && <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>}
              {n.sender && (
                <p className="text-xs text-gray-400 mt-1">
                  Gönderen: {n.sender.firstName} {n.sender.lastName}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 shrink-0">
              {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand-600" />}
              {n.type === 'MESSAGE' && n.sender && (
                <button
                  onClick={() => onReply(n)}
                  title="Yanıtla"
                  className="text-gray-400 hover:text-brand-600"
                >
                  <Reply size={16} />
                </button>
              )}
              <button
                onClick={() => onDelete(n.id)}
                title="Sil"
                className="text-gray-400 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ThreadMessage {
  id: string;
  senderId: string | null;
  title: string;
  body?: string | null;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  createdAt: string;
}

/** Seçili kişiyle aramızdaki eski mesajlar — normal bir sohbet alanı gibi. */
function MessageThread({ otherId }: { otherId: string }) {
  const { data: messages } = useQuery<ThreadMessage[]>({
    queryKey: ['notif-thread', otherId],
    queryFn: () => api.get(`/notifications/thread/${otherId}`),
    refetchInterval: 15000,
  });

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 flex flex-col">
      {!messages ? (
        <p className="text-sm text-gray-400">Yükleniyor...</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-gray-400 m-auto">Bu kişiyle henüz mesajlaşma yok.</p>
      ) : (
        messages.map((m) => {
          const fromMe = m.senderId !== otherId;
          return (
            <div
              key={m.id}
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                fromMe ? 'ml-auto bg-brand-100 text-brand-900' : 'bg-white border border-gray-200 text-gray-800'
              }`}
            >
              <p className="font-medium">{m.title}</p>
              {m.body && <p className="text-gray-600 mt-0.5">{m.body}</p>}
              <p className="text-[11px] text-gray-400 mt-1">{timeAgo(m.createdAt)}</p>
            </div>
          );
        })
      )}
    </div>
  );
}

function PriorityPicker({
  value, onChange, compact,
}: {
  value: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  onChange: (v: 'NORMAL' | 'IMPORTANT' | 'URGENT') => void;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="flex gap-2">
        {([
          ['NORMAL', 'Normal', 'bg-gray-100 text-gray-700'],
          ['IMPORTANT', 'Önemli', 'bg-amber-100 text-amber-800'],
          ['URGENT', 'Çok Önemli', 'bg-red-100 text-red-700'],
        ] as const).map(([val, label, cls]) => (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-lg font-medium border ${
              value === val ? `${cls} border-transparent ring-2 ring-offset-1 ring-current` : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {value === 'URGENT' && !compact && (
        <p className="text-xs text-red-500 mt-1">
          Alıcının telefonunda farklı sesle, kırmızı heads-up bildirim olarak düşer.
        </p>
      )}
    </div>
  );
}

function ComposeMessage({ replyTo, onSent }: { replyTo: ReplyTo; onSent: () => void }) {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canBroadcast = hasRole('HR', 'ADMIN', 'ACCOUNTING');
  const [broadcast, setBroadcast] = useState(false);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'IMPORTANT' | 'URGENT'>('NORMAL');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(replyTo ? [replyTo.id] : []),
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [chatTitle, setChatTitle] = useState('');
  const [chatText, setChatText] = useState('');

  const { data: recipients } = useQuery<Recipient[]>({
    queryKey: ['notif-recipients'],
    queryFn: () => api.get('/notifications/recipients'),
  });

  // Gönderim seçenekleri (alıcı/duyuru/önem) aynı kalıyor; tek bir alıcıyla
  // (ya da yanıt modunda) normal bir sohbet alanı gibi eski mesajlar + mesaj
  // kutusu gösteriliyor. Birden fazla alıcı / toplu duyuruda eski form kalıyor.
  const chatOtherId = !broadcast ? (replyTo?.id ?? (selected.size === 1 ? [...selected][0] : null)) : null;
  const chatMode = chatOtherId != null;

  const send = useMutation({
    mutationFn: () => {
      if (replyTo && !broadcast) {
        return api.post(`/notifications/${replyTo.notificationId}/reply`, {
          title: chatMode ? chatTitle : title,
          body: (chatMode ? chatText : body) || undefined,
          priority,
        });
      }
      if (broadcast) {
        return api.post('/notifications/broadcast', { title, body: body || undefined, priority });
      }
      return api.post('/notifications/message', {
        recipientIds: [...selected],
        title: chatMode ? chatTitle : title,
        body: (chatMode ? chatText : body) || undefined,
        priority,
      });
    },
    onSuccess: (res: any) => {
      if (!chatMode) toast.success(`${res.sent} kişiye gönderildi`);
      setTitle('');
      setBody('');
      setChatTitle('');
      setChatText('');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      if (chatOtherId) qc.invalidateQueries({ queryKey: ['notif-thread', chatOtherId] });
      if (chatMode) {
        // Sohbet modunda ekrandan çıkmadan devam edilebilsin.
        return;
      }
      setSelected(new Set());
      setBroadcast(false);
      setPriority('NORMAL');
      onSent();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Gönderilemedi'),
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const filtered = (recipients ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${r.firstName} ${r.lastName} ${r.position ?? ''} ${r.department ?? ''}`
      .toLowerCase()
      .includes(q);
  });
  const selectedPerson = recipients?.find((r) => r.id === chatOtherId);
  const canSend = chatMode
    ? chatTitle.trim().length > 0 && chatText.trim().length > 0
    : title.trim().length > 0 && (broadcast || selected.size > 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        İstediğiniz herhangi bir çalışana mesaj gönderebilirsiniz; tek tek seçebilirsiniz
        {canBroadcast && ' veya toplu duyuru olarak tüm personele gönderebilirsiniz'}.
      </p>

      <div className="card space-y-4">
        {canBroadcast && (
        <label className="flex items-center gap-2 text-sm bg-brand-50 text-brand-800 rounded-lg px-3 py-2">
          <input type="checkbox" className="accent-brand-600" checked={broadcast}
            onChange={(e) => { setBroadcast(e.target.checked); setSelected(new Set()); }} />
          Herkese gönder (toplu duyuru)
        </label>
        )}

        {!broadcast && !replyTo && !chatMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alıcılar ({selected.size} seçili)
            </label>
            <input
              className="input mb-2"
              placeholder="Ad, departman veya pozisyona göre ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {!recipients ? (
              <p className="text-sm text-gray-400">Yükleniyor...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400">Kişi bulunamadı.</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {filtered.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                      className="w-4 h-4 accent-brand-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-gray-500">
                        {[p.position, p.department].filter(Boolean).join(' · ') || '-'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {chatMode ? (
          <div className="-m-4 sm:-m-6 flex flex-col" style={{ height: 480 }}>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                {replyTo ? <><Reply size={15} className="text-brand-600" /> {replyTo.name}</>
                  : selectedPerson ? `${selectedPerson.firstName} ${selectedPerson.lastName}` : '...'}
              </div>
              {!replyTo && (
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Değiştir
                </button>
              )}
            </div>
            <MessageThread otherId={chatOtherId!} />
            <div className="border-t border-gray-200 p-3 space-y-2">
              <input
                className="input"
                value={chatTitle}
                onChange={(e) => setChatTitle(e.target.value)}
                placeholder="Başlık"
                maxLength={150}
              />
              <PriorityPicker value={priority} onChange={setPriority} compact />
              <div className="flex gap-2 items-end">
                <textarea
                  className="input flex-1"
                  rows={2}
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (canSend && !send.isPending) send.mutate();
                    }
                  }}
                  placeholder="Mesajınızı yazın..."
                  maxLength={2000}
                />
                <button onClick={() => send.mutate()} disabled={!canSend || send.isPending}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50 h-fit">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Mesaj başlığı" maxLength={150} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mesaj</label>
              <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="Mesajınızı yazın..." maxLength={2000} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Önem</label>
              <PriorityPicker value={priority} onChange={setPriority} />
            </div>

            <button onClick={() => send.mutate()} disabled={!canSend || send.isPending}
              className="btn-primary flex items-center gap-2 disabled:opacity-50">
              <Send size={16} /> Gönder
            </button>
          </>
        )}
      </div>
    </div>
  );
}

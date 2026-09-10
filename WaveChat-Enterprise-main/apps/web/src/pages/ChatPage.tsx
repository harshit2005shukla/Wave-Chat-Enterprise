import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { api } from '../lib/api';
import { conversationKey, decryptText, encryptText } from '../lib/crypto';
import type { Conversation, Message, User } from '../types';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { Avatar } from '../components/Avatar';
import { Composer, type Attachment } from '../components/Composer';
import { MessageBubble } from '../components/MessageBubble';
import { NewConversationModal } from '../components/NewConversationModal';
import { StatusDrawer } from '../components/StatusDrawer';
import { CallOverlay, type CallState } from '../components/CallOverlay';

function peerOf(conversation: Conversation, me: User) {
  return conversation.members.find(member => member._id !== me._id);
}
function titleOf(conversation: Conversation, me: User) {
  return conversation.type === 'group' ? conversation.title ?? 'Group' : peerOf(conversation, me)?.name ?? 'Direct chat';
}

export function ChatPage() {
  const { user: me, logout } = useAuth();
  const socket = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [modal, setModal] = useState<'chat' | 'group'>();
  const [showStatuses, setShowStatuses] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [call, setCall] = useState<CallState>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Conversation>();
  activeRef.current = active;

  async function loadConversations(selectFirst = false) {
    const data = await api<{ conversations: Conversation[] }>('/conversations');
    setConversations(data.conversations);
    if (activeRef.current) {
      const fresh = data.conversations.find(item => item._id === activeRef.current?._id);
      if (fresh) setActive(fresh);
    } else if (selectFirst && data.conversations[0]) setActive(data.conversations[0]);
  }

  useEffect(() => { loadConversations(true).catch(error => setError(error.message)); }, []);

  async function hydrateMessage(message: Message, conversation: Conversation) {
    try {
      const key = await conversationKey(conversation, me!);
      return { ...message, plaintext: await decryptText(key, message.ciphertext, message.iv) };
    } catch (error) {
      return { ...message, plaintext: `[Unable to decrypt: ${error instanceof Error ? error.message : 'key error'}]` };
    }
  }

  useEffect(() => {
    if (!active) { setMessages([]); return; }
    let cancelled = false;
    setLoadingMessages(true); setError('');
    socket?.emit('conversation:join', active._id);
    api<{ messages: Message[] }>(`/messages/${active._id}`).then(async data => {
      const hydrated = await Promise.all(data.messages.map(message => hydrateMessage(message, active)));
      if (cancelled) return;
      setMessages(hydrated);
      const unread = hydrated.filter(message => message.sender._id !== me!._id).map(message => message._id);
      if (unread.length) socket?.emit('message:read', { conversationId: active._id, messageIds: unread });
      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
    }).catch(error => setError(error.message)).finally(() => !cancelled && setLoadingMessages(false));
    return () => { cancelled = true; };
  }, [active?._id, socket]);

  useEffect(() => {
    if (!socket || !me) return;
    const onMessage = async (raw: Message) => {
      const conversationId = String(raw.conversation);
      setConversations(items => items.map(item => item._id === conversationId ? { ...item, lastMessageAt: raw.createdAt } : item)
        .sort((a, b) => new Date(b.lastMessageAt ?? b.createdAt).getTime() - new Date(a.lastMessageAt ?? a.createdAt).getTime()));
      if (raw.sender._id !== me._id) socket.emit('message:delivered', { messageId: raw._id });
      const current = activeRef.current;
      if (!current || current._id !== conversationId) return;
      const hydrated = await hydrateMessage(raw, current);
      setMessages(items => items.some(item => item._id === raw._id) ? items : [...items, hydrated]);
      if (raw.sender._id !== me._id) socket.emit('message:read', { conversationId, messageIds: [raw._id] });
      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 20);
    };
    const onReceipt = (receipt: { messageId?: string; messageIds?: string[]; userId: string; kind: 'delivered' | 'read' }) => {
      const ids = new Set(receipt.messageIds ?? (receipt.messageId ? [receipt.messageId] : []));
      setMessages(items => items.map(message => ids.has(message._id) ? {
        ...message,
        deliveredTo: receipt.kind === 'delivered' || receipt.kind === 'read' ? [...new Set([...(message.deliveredTo ?? []), receipt.userId])] : message.deliveredTo,
        readBy: receipt.kind === 'read' ? [...new Set([...(message.readBy ?? []), receipt.userId])] : message.readBy
      } : message));
    };
    const onEdited = async (event: { messageId: string; ciphertext: string; iv: string; editedAt: string }) => {
      const current = activeRef.current; if (!current) return;
      try {
        const plaintext = await decryptText(await conversationKey(current, me), event.ciphertext, event.iv);
        setMessages(items => items.map(item => item._id === event.messageId ? { ...item, ...event, plaintext } : item));
      } catch { /* another conversation */ }
    };
    const onDeleted = ({ messageId, deletedAt }: { messageId: string; deletedAt: string }) => setMessages(items => items.map(item => item._id === messageId ? { ...item, deletedForEveryoneAt: deletedAt, plaintext: 'This message was deleted' } : item));
    const onTyping = ({ conversationId, userId, isTyping }: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (activeRef.current?._id === conversationId) setTypingUsers(items => ({ ...items, [userId]: isTyping }));
    };
    const onPresence = ({ userId, isOnline, lastSeenAt }: { userId: string; isOnline: boolean; lastSeenAt: string }) => {
      setConversations(items => items.map(conversation => ({ ...conversation, members: conversation.members.map(member => member._id === userId ? { ...member, isOnline, lastSeenAt } : member) })));
    };
    const onIncoming = async (incoming: { callId: string; callerId: string; type: 'audio' | 'video'; offer: RTCSessionDescriptionInit }) => {
      try {
        const known = conversations.flatMap(item => item.members).find(item => item._id === incoming.callerId);
        const peer = known ?? (await api<{ user: User }>(`/users/${incoming.callerId}`)).user;
        setCall({ direction: 'incoming', peer, type: incoming.type, callId: incoming.callId, offer: incoming.offer });
      } catch (error) { setError(error instanceof Error ? error.message : 'Incoming call error'); }
    };
    socket.on('message:new', onMessage); socket.on('message:receipt', onReceipt); socket.on('message:edited', onEdited);
    socket.on('message:deleted', onDeleted); socket.on('typing:update', onTyping); socket.on('presence:update', onPresence); socket.on('call:incoming', onIncoming);
    return () => {
      socket.off('message:new', onMessage); socket.off('message:receipt', onReceipt); socket.off('message:edited', onEdited);
      socket.off('message:deleted', onDeleted); socket.off('typing:update', onTyping); socket.off('presence:update', onPresence); socket.off('call:incoming', onIncoming);
    };
  }, [socket, me, conversations]);

  async function send(text: string, attachment?: Attachment) {
    if (!active || !me) return;
    const key = await conversationKey(active, me);
    const encrypted = await encryptText(key, text || attachment?.name || 'Attachment');
    const payload = {
      conversationId: active._id, clientId: crypto.randomUUID(), type: attachment?.type ?? 'text', ...encrypted,
      mediaUrl: attachment?.url, mediaName: attachment?.name, mediaMime: attachment?.mime, mediaSize: attachment?.size
    };
    if (socket?.connected) {
      await new Promise<void>((resolve, reject) => socket.emit('message:send', payload, (result: { ok: boolean; error?: string }) => result.ok ? resolve() : reject(new Error(result.error))));
    } else {
      const data = await api<{ message: Message }>('/messages', { method: 'POST', body: JSON.stringify(payload) });
      const hydrated = await hydrateMessage(data.message, active); setMessages(items => [...items, hydrated]);
    }
  }

  async function editMessage(message: Message) {
    if (!active || !me) return;
    const next = window.prompt('Edit encrypted message', message.plaintext ?? ''); if (!next?.trim()) return;
    const encrypted = await encryptText(await conversationKey(active, me), next.trim());
    socket?.emit('message:edit', { messageId: message._id, ...encrypted }, (result: { ok: boolean; error?: string }) => !result.ok && setError(result.error ?? 'Edit failed'));
  }
  function deleteMessage(message: Message) {
    if (!window.confirm('Delete this message for everyone?')) return;
    socket?.emit('message:delete', { messageId: message._id }, (result: { ok: boolean; error?: string }) => !result.ok && setError(result.error ?? 'Delete failed'));
  }
  function created(conversation: Conversation) {
    setConversations(items => [conversation, ...items.filter(item => item._id !== conversation._id)]); setActive(conversation); setModal(undefined);
    socket?.emit('conversation:join', conversation._id);
  }
  const activePeer = active && me ? peerOf(active, me) : undefined;
  const typingNames = useMemo(() => active?.members.filter(member => member._id !== me?._id && typingUsers[member._id]).map(member => member.name) ?? [], [active, typingUsers, me?._id]);

  if (!me) return null;
  return <main className={`app-shell ${active ? 'chat-selected' : ''}`}>
    <ConversationSidebar conversations={conversations} activeId={active?._id} me={me} onSelect={setActive} onNewChat={() => setModal('chat')} onNewGroup={() => setModal('group')} onStatuses={() => setShowStatuses(true)} onLogout={logout} />
    <section className="chat-area">
      {active ? <>
        <header className="chat-header">
          <button className="mobile-back" onClick={() => setActive(undefined)}>‹</button>
          <Avatar user={activePeer} label={titleOf(active, me)} />
          <div className="chat-title"><strong>{titleOf(active, me)}</strong><small>{typingNames.length ? `${typingNames.join(', ')} typing…` : active.type === 'group' ? `${active.members.length} members · end-to-end encrypted demo` : activePeer?.isOnline ? 'online' : activePeer?.lastSeenAt ? `last seen ${new Date(activePeer.lastSeenAt).toLocaleString()}` : 'end-to-end encrypted demo'}</small></div>
          {active.type === 'direct' && activePeer && socket && <div className="chat-actions"><button title="Audio call" onClick={() => setCall({ direction: 'outgoing', peer: activePeer, type: 'audio' })}>☎</button><button title="Video call" onClick={() => setCall({ direction: 'outgoing', peer: activePeer, type: 'video' })}>▣</button></div>}
        </header>
        {error && <div className="inline-error">{error}<button onClick={() => setError('')}>×</button></div>}
        <div className="message-canvas">
          <div className="conversation-security">🔐 Messages in this conversation are encrypted before they leave your browser.</div>
          {loadingMessages ? <div className="screen-center inside"><div className="loader" /></div> : messages.map(message => <MessageBubble key={message._id} message={message} mine={message.sender._id === me._id} onEdit={() => editMessage(message)} onDelete={() => deleteMessage(message)} />)}
          {!loadingMessages && !messages.length && <div className="chat-empty"><span>👋</span><h3>Start the conversation</h3><p>Your first message will be encrypted locally using this conversation’s key.</p></div>}
          <div ref={bottomRef} />
        </div>
        <Composer onSend={send} onTyping={isTyping => socket?.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId: active._id })} />
      </> : <div className="welcome-panel"><div className="welcome-icon">W</div><h1>WaveChat Enterprise</h1><p>Select a conversation or create a new encrypted chat.</p><div><span>🔐 Client-side encryption</span><span>⚡ Live delivery</span><span>📞 WebRTC calls</span></div></div>}
    </section>
    {modal && <NewConversationModal mode={modal} me={me} onClose={() => setModal(undefined)} onCreated={created} />}
    {showStatuses && <StatusDrawer me={me} conversations={conversations} onClose={() => setShowStatuses(false)} />}
    {call && socket && <CallOverlay socket={socket} call={call} onClose={() => setCall(undefined)} />}
  </main>;
}

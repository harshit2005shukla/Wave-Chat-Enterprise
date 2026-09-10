import { useMemo, useState } from 'react';
import type { Conversation, User } from '../types';
import { Avatar } from './Avatar';

function details(conversation: Conversation, me: User) {
  if (conversation.type === 'group') return { name: conversation.title ?? 'Group', user: undefined };
  const peer = conversation.members.find(member => member._id !== me._id);
  return { name: peer?.name ?? 'Direct chat', user: peer };
}
export function ConversationSidebar({ conversations, activeId, me, onSelect, onNewChat, onNewGroup, onStatuses, onLogout }: {
  conversations: Conversation[]; activeId?: string; me: User; onSelect(c: Conversation): void; onNewChat(): void; onNewGroup(): void; onStatuses(): void; onLogout(): void;
}) {
  const [filter, setFilter] = useState('');
  const visible = useMemo(() => conversations.filter(c => details(c, me).name.toLowerCase().includes(filter.toLowerCase())), [conversations, filter, me]);
  return <aside className="sidebar">
    <header className="sidebar-header">
      <div className="profile-summary"><Avatar user={me} /><div><strong>{me.name}</strong><small>{me.about ?? 'Available'}</small></div></div>
      <div className="header-actions"><button title="Status" onClick={onStatuses}>◉</button><button title="New group" onClick={onNewGroup}>👥</button><button title="New chat" onClick={onNewChat}>✎</button><button title="Logout" onClick={onLogout}>↪</button></div>
    </header>
    <div className="search-box"><span>⌕</span><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search conversations" /></div>
    <div className="encryption-banner"><span>🔐</span><span>Messages are encrypted in your browser.</span></div>
    <div className="conversation-list">
      {visible.map(conversation => { const info = details(conversation, me); return <button key={conversation._id} className={`conversation-item ${activeId === conversation._id ? 'active' : ''}`} onClick={() => onSelect(conversation)}>
        <Avatar user={info.user} label={info.name} /><div className="conversation-copy"><div><strong>{info.name}</strong><time>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time></div><p>{conversation.type === 'group' ? `${conversation.members.length} members` : info.user?.isOnline ? 'online' : info.user?.about ?? 'Encrypted chat'}</p></div>
      </button>; })}
      {!visible.length && <div className="empty-list">No conversations yet.<button onClick={onNewChat}>Start a secure chat</button></div>}
    </div>
  </aside>;
}

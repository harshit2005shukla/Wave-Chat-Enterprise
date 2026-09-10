import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { createWrappedKeys, rememberGroupKey } from '../lib/crypto';
import type { Conversation, User } from '../types';
import { Avatar } from './Avatar';

export function NewConversationModal({ mode, me, onClose, onCreated }: { mode: 'chat' | 'group'; me: User; onClose(): void; onCreated(c: Conversation): void }) {
  const [query, setQuery] = useState(''); const [users, setUsers] = useState<User[]>([]); const [selected, setSelected] = useState<User[]>([]);
  const [title, setTitle] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim().length < 2) return setUsers([]);
      api<{ users: User[] }>(`/users/search?q=${encodeURIComponent(query)}`).then(data => setUsers(data.users)).catch(error => setError(error.message));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  async function direct(user: User) {
    setBusy(true); setError('');
    try { const { conversation } = await api<{ conversation: Conversation }>('/conversations/direct', { method: 'POST', body: JSON.stringify({ userId: user._id }) }); onCreated(conversation); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to create conversation'); } finally { setBusy(false); }
  }
  async function group() {
    if (!title.trim() || !selected.length) return; setBusy(true); setError('');
    try {
      const { key, raw, wrappedKeys } = await createWrappedKeys([me, ...selected]);
      const { conversation } = await api<{ conversation: Conversation }>('/conversations/group', {
        method: 'POST', body: JSON.stringify({ title: title.trim(), memberIds: selected.map(user => user._id), wrappedKeys })
      });
      rememberGroupKey(conversation._id, raw, key); onCreated(conversation);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to create group'); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal-panel">
      <header><div><span className="eyebrow">{mode === 'chat' ? 'DIRECT MESSAGE' : 'ENCRYPTED GROUP'}</span><h3>{mode === 'chat' ? 'Start a new conversation' : 'Create a secure group'}</h3></div><button className="close-button" onClick={onClose}>×</button></header>
      {mode === 'group' && <label className="field-label">Group name<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Project team" /></label>}
      {selected.length > 0 && <div className="selected-users">{selected.map(user => <button key={user._id} onClick={() => setSelected(items => items.filter(item => item._id !== user._id))}>{user.name} ×</button>)}</div>}
      <div className="search-box modal-search"><span>⌕</span><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or phone" /></div>
      {error && <div className="error-banner">{error}</div>}
      <div className="user-results">
        {users.map(user => { const selectedNow = selected.some(item => item._id === user._id); return <button key={user._id} disabled={busy} onClick={() => mode === 'chat' ? direct(user) : setSelected(items => selectedNow ? items.filter(item => item._id !== user._id) : [...items, user])}>
          <Avatar user={user} /><span><strong>{user.name}</strong><small>{user.phone} · {user.publicKeyJwk ? 'encryption ready' : 'key unavailable'}</small></span>{mode === 'group' && <i>{selectedNow ? '✓' : '+'}</i>}
        </button>; })}
        {query.length >= 2 && !users.length && <div className="empty-list">No registered users found.</div>}
      </div>
      {mode === 'group' && <footer><button className="primary-button" disabled={busy || !title.trim() || !selected.length} onClick={group}>{busy ? 'Creating…' : `Create group (${selected.length + 1})`}</button></footer>}
    </section>
  </div>;
}

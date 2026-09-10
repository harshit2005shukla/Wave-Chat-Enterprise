import { useEffect, useMemo, useState } from 'react';
import { api, SERVER_URL } from '../lib/api';
import { createWrappedKeys, encryptText, statusKey, decryptText } from '../lib/crypto';
import type { Conversation, StatusItem, User } from '../types';
import { Avatar } from './Avatar';

export function StatusDrawer({ me, conversations, onClose }: { me: User; conversations: Conversation[]; onClose(): void }) {
  const [statuses, setStatuses] = useState<StatusItem[]>([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const audience = useMemo(() => {
    const map = new Map<string, User>();
    for (const conversation of conversations) for (const member of conversation.members) if (member._id !== me._id && member.publicKeyJwk) map.set(member._id, member);
    return [...map.values()];
  }, [conversations, me._id]);
  async function load() {
    const data = await api<{ statuses: StatusItem[] }>('/statuses/feed');
    const hydrated = await Promise.all(data.statuses.map(async item => {
      try { return { ...item, plaintext: await decryptText(await statusKey(item, me), item.ciphertext, item.iv) }; }
      catch { return { ...item, plaintext: 'Encrypted status unavailable on this device' }; }
    }));
    setStatuses(hydrated);
  }
  useEffect(() => { load().catch(error => setError(error.message)); }, []);
  async function create() {
    if (!text.trim()) return; setBusy(true); setError('');
    try {
      const recipients = [me, ...audience];
      const { key, wrappedKeys } = await createWrappedKeys(recipients);
      const encrypted = await encryptText(key, text.trim());
      await api('/statuses', { method: 'POST', body: JSON.stringify({ type: 'text', ...encrypted, background: '#005c4b', audience: audience.map(user => user._id), wrappedKeys }) });
      setText(''); await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to publish status'); } finally { setBusy(false); }
  }
  return <div className="drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="status-drawer">
      <header><div><span className="eyebrow">24-HOUR UPDATES</span><h3>Status</h3></div><button className="close-button" onClick={onClose}>×</button></header>
      <section className="status-create"><Avatar user={me} /><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Share an encrypted update…" /><button onClick={create} disabled={busy || !text.trim()}>{busy ? '…' : 'Post'}</button></section>
      <small className="audience-note">Visible to {audience.length} encryption-ready contact{audience.length === 1 ? '' : 's'}.</small>
      {error && <div className="error-banner">{error}</div>}
      <div className="status-list">
        {statuses.map(status => <article className="status-card" key={status._id} style={{ background: status.background ?? '#005c4b' }}>
          <header><Avatar user={status.owner} size="sm" /><div><strong>{status.owner.name}</strong><small>{new Date(status.createdAt).toLocaleString()}</small></div></header>
          {status.type === 'image' && status.mediaUrl && <img src={`${SERVER_URL}${status.mediaUrl}`} alt="Status" />}
          <p>{status.plaintext}</p>
          {status.owner._id === me._id && <small>{status.viewedBy.length} views</small>}
        </article>)}
        {!statuses.length && <div className="empty-list">No active status updates.</div>}
      </div>
    </aside>
  </div>;
}

import { SERVER_URL } from '../lib/api';
import type { Message } from '../types';

function Media({ message }: { message: Message }) {
  if (!message.mediaUrl) return null;
  const src = `${SERVER_URL}${message.mediaUrl}`;
  if (message.type === 'image') return <a href={src} target="_blank" rel="noreferrer"><img className="message-image" src={src} alt={message.mediaName ?? 'Shared image'} /></a>;
  if (message.type === 'video') return <video className="message-video" src={src} controls />;
  if (message.type === 'audio') return <audio className="message-audio" src={src} controls />;
  return <a className="document-card" href={src} target="_blank" rel="noreferrer"><span>📄</span><span><strong>{message.mediaName ?? 'Document'}</strong><small>{message.mediaSize ? `${Math.ceil(message.mediaSize / 1024)} KB` : message.mediaMime}</small></span></a>;
}

export function MessageBubble({ message, mine, onEdit, onDelete }: { message: Message; mine: boolean; onEdit(): void; onDelete(): void }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const delivered = message.deliveredTo?.length > 1;
  const read = message.readBy?.length > 1;
  return <div className={`message-row ${mine ? 'mine' : ''}`}>
    <div className={`message-bubble ${mine ? 'bubble-mine' : 'bubble-other'}`}>
      {!mine && <span className="message-sender">{message.sender.name}</span>}
      <Media message={message} />
      <div className="message-text">{message.deletedForEveryoneAt ? <em>This message was deleted</em> : message.plaintext ?? 'Decrypting…'}</div>
      <div className="message-meta">
        {message.editedAt && <span>edited</span>}<span>{time}</span>{mine && <span className={`ticks ${read ? 'read' : ''}`}>{read ? '✓✓' : delivered ? '✓✓' : '✓'}</span>}
      </div>
      {mine && !message.deletedForEveryoneAt && <div className="message-actions"><button onClick={onEdit}>Edit</button><button onClick={onDelete}>Delete</button></div>}
    </div>
  </div>;
}

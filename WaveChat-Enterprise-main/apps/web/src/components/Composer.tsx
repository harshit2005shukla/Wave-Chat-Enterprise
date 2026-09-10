import { useRef, useState, type FormEvent } from 'react';
import { uploadFile } from '../lib/api';

export interface Attachment { url: string; name: string; mime: string; size: number; type: 'image' | 'video' | 'audio' | 'document' }
function kind(mime: string): Attachment['type'] {
  if (mime.startsWith('image/')) return 'image'; if (mime.startsWith('video/')) return 'video'; if (mime.startsWith('audio/')) return 'audio'; return 'document';
}
export function Composer({ onSend, onTyping, disabled }: { onSend(text: string, attachment?: Attachment): Promise<void>; onTyping(active: boolean): void; disabled?: boolean }) {
  const [text, setText] = useState(''); const [attachment, setAttachment] = useState<Attachment>(); const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null); const typingTimer = useRef<number | undefined>(undefined);
  async function submit(event: FormEvent) {
    event.preventDefault(); if ((!text.trim() && !attachment) || busy) return;
    setBusy(true); try { await onSend(text.trim(), attachment); setText(''); setAttachment(undefined); onTyping(false); } finally { setBusy(false); }
  }
  async function choose(file?: File) {
    if (!file) return; setBusy(true);
    try { const result = await uploadFile(file); setAttachment({ ...result.file, type: kind(result.file.mime) }); }
    catch (error) { alert(error instanceof Error ? error.message : 'Upload failed'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  function change(value: string) {
    setText(value); onTyping(true); window.clearTimeout(typingTimer.current); typingTimer.current = window.setTimeout(() => onTyping(false), 1200);
  }
  return <form className="composer" onSubmit={submit}>
    {attachment && <div className="attachment-chip"><span>📎 {attachment.name}</span><button type="button" onClick={() => setAttachment(undefined)}>×</button></div>}
    <div className="composer-row">
      <button className="icon-button" type="button" title="Attach file" onClick={() => fileRef.current?.click()}>＋</button>
      <input ref={fileRef} type="file" hidden onChange={e => choose(e.target.files?.[0])} />
      <textarea value={text} onChange={e => change(e.target.value)} placeholder="Type an encrypted message" rows={1} disabled={disabled || busy}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
      <button className="send-button" disabled={disabled || busy || (!text.trim() && !attachment)}>{busy ? '…' : '➤'}</button>
    </div>
  </form>;
}

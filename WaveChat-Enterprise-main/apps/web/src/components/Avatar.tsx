import type { User } from '../types';
export function Avatar({ user, label, size = 'md' }: { user?: User; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const text = label ?? user?.name ?? '?';
  return <div className={`avatar avatar-${size}`} title={text}>
    {user?.avatarUrl ? <img src={user.avatarUrl} alt={text} /> : text.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()}
    {user?.isOnline && <span className="online-dot" />}
  </div>;
}

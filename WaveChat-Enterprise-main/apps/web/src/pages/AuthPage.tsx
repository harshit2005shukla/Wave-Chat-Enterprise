import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+919999000002');
  const [password, setPassword] = useState('Password@123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try { mode === 'login' ? await login(phone, password) : await register(name, phone, password); }
    catch (error) { setError(error instanceof Error ? error.message : 'Authentication failed'); }
    finally { setBusy(false); }
  }
  return <div className="auth-shell">
    <section className="auth-hero">
      <div className="brand-mark">W</div>
      <span className="eyebrow">WAVECHAT ENTERPRISE</span>
      <h1>Private conversations.<br/>Professional architecture.</h1>
      <p>A complete real-time messaging demonstration with client-side encryption, groups, status, media, presence, receipts and WebRTC calls.</p>
      <div className="feature-grid">
        <span>🔐 AES-GCM encryption</span><span>⚡ Real-time Socket.IO</span><span>📞 WebRTC calls</span><span>👥 Group key wrapping</span>
      </div>
    </section>
    <section className="auth-card-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="mobile-brand"><div className="brand-mark small">W</div><strong>WaveChat</strong></div>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p>{mode === 'login' ? 'Use your registered phone number.' : 'Your browser creates a cryptographic identity.'}</p>
        {mode === 'register' && <label>Full name<input value={name} onChange={e => setName(e.target.value)} minLength={2} required placeholder="Shivam Singh" /></label>}
        <label>Phone number<input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+919876543210" /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required /></label>
        {error && <div className="error-banner">{error}</div>}
        <button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : 'Create encrypted account'}</button>
        <button type="button" className="link-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Already registered? Sign in'}
        </button>
        <div className="demo-note"><strong>Demo:</strong> +919999000002 / Password@123</div>
      </form>
    </section>
  </div>;
}

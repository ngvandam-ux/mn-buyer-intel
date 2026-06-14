import { type ReactNode, useEffect, useState } from 'react';
import { REQUIRE_AUTH, UNAUTHORIZED_EVENT, hasCreds, setCreds } from '../auth.ts';

/**
 * Renders a sign-in screen until shared Basic Auth credentials are present (prod only).
 * In dev (VITE_REQUIRE_AUTH unset) it's a pass-through. A 401 from the API clears creds
 * and bounces back here.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(!REQUIRE_AUTH || hasCreds());
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!REQUIRE_AUTH) return;
    const onUnauthorized = () => {
      setError('Sign-in failed or session expired.');
      setAuthed(false);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  if (authed) return <>{children}</>;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <form
        className="card pad"
        style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!user || !pass) {
            setError('Enter username and password.');
            return;
          }
          setCreds(user, pass);
          setError(null);
          setAuthed(true);
        }}
      >
        <div className="inline" style={{ gap: 10 }}>
          <div className="mark" style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#3b82f6,#1e4e8c)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>MN</div>
          <div>
            <h3 style={{ fontSize: 15 }}>Buyer Intelligence</h3>
            <div className="t-sub">Sign in to continue</div>
          </div>
        </div>
        <div className="field">
          <label>Username</label>
          <input type="text" value={user} autoFocus onChange={(e) => setUser(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        <button className="btn primary" type="submit">Sign in</button>
      </form>
    </div>
  );
}

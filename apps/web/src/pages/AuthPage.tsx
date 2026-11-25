import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [organizationName, setOrganizationName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!acceptedPrivacyPolicy) {
          throw new Error('Explicit LGPD/GDPR privacy policy consent is required.');
        }
        await register({
          organizationName,
          fullName,
          email,
          password,
          acceptedPrivacyPolicy: true,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="panel" style={{ width: '100%', maxWidth: 440, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <ShieldCheck size={22} color="#1d4ed8" />
          <strong style={{ fontSize: 18, letterSpacing: '-0.02em' }}>OpsFlow Enterprise</strong>
        </div>
        <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 13 }}>
          Multi-Tenant Field Operations &amp; LGPD/GDPR Compliance Console
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => { setMode('login'); setError(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`btn ${mode === 'register' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => { setMode('register'); setError(null); }}
          >
            Provision Tenant
          </button>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <>
              <div className="field">
                <label>Organization / Company Name</label>
                <input className="input" required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Dublin Precision Engineering Ltd" />
              </div>
              <div className="field">
                <label>Administrator Full Name</label>
                <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Guilherme Oliveira" />
              </div>
            </>
          )}
          <div className="field">
            <label>Work Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ops@company.ie" />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars, 1 uppercase, 1 number" />
          </div>

          {mode === 'register' && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={acceptedPrivacyPolicy} onChange={(e) => setAcceptedPrivacyPolicy(e.target.checked)} style={{ marginTop: 3 }} />
              <span>I consent to data processing under Privacy Policy v2026.1 (LGPD Art. 7 / GDPR Art. 6).</span>
            </label>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Processing...' : mode === 'login' ? 'Access Workspace' : 'Create Tenant & Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
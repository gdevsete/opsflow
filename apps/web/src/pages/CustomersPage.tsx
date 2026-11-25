import React, { useState } from 'react';
import { Download, Lock, UserX } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { Customer } from '../lib/types';

interface Props { customers: Customer[]; onRefresh: () => Promise<void>; }

export function CustomersPage({ customers, onRefresh }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportPreview, setExportPreview] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, document, addressLine, consentGranted: true }),
      });
      setName(''); setEmail(''); setPhone(''); setDocument(''); setAddressLine('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register customer');
    } finally { setSubmitting(false); }
  };

  const handleExport = async (id: string) => {
    setError(null);
    try {
      const res = await apiRequest<{ data: unknown }>(`/privacy/customers/${id}/export`);
      setExportPreview(JSON.stringify(res.data, null, 2));
      await onRefresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Export failed'); }
  };

  const handleAnonymize = async (c: Customer) => {
    if (!window.confirm(`IRREVERSIBLE LGPD ART. 18 ERASURE:\nScrub all PII for "${c.name}"?`)) return;
    setError(null);
    try {
      await apiRequest(`/privacy/customers/${c.id}/anonymize`, { method: 'POST' });
      setExportPreview(null);
      await onRefresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Anonymization failed'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="panel" style={{ padding: 20 }}>
        <h3 className="panel-title" style={{ marginBottom: 4 }}>Register Customer (AES-256-GCM PII Vault)</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
          Tax IDs are encrypted at rest with AES-256-GCM and indexed via HMAC-SHA256 blind hashes.
        </p>
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleCreate} className="form-grid">
          <div className="field"><label>Full Name / Legal Entity</label><input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Sean O'Connor" /></div>
          <div className="field"><label>Tax ID / PPSN / CPF (Encrypted)</label><input className="input mono" value={document} onChange={(e) => setDocument(e.target.value)} placeholder="12345678901" /></div>
          <div className="field"><label>Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sean@client.ie" /></div>
          <div className="field"><label>Phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+353 87 123 4567" /></div>
          <div className="field field-full"><label>Service Address</label><input className="input" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="22 Merrion Square, Dublin 2" /></div>
          <div className="field-full"><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Encrypting & Saving...' : 'Save Customer & Record Consent'}</button></div>
        </form>
      </div>
      {exportPreview && (
        <div className="panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ fontSize: 13.5 }}>LGPD Art. 18, V / GDPR Art. 20 - Data Portability Bundle (Audited)</strong>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExportPreview(null)}>Close</button>
          </div>
          <pre className="mono" style={{ margin: 0, padding: 14, background: '#0f172a', color: '#e2e8f0', borderRadius: 4, fontSize: 12, overflowX: 'auto' }}>{exportPreview}</pre>
        </div>
      )}
      <div className="panel">
        <div className="panel-header"><h3 className="panel-title">Tenant Customer Directory ({customers.length})</h3></div>
        <table className="data-table">
          <thead><tr><th>Customer</th><th>Contact</th><th>PII Vault</th><th>Compliance State</th><th>Data Subject Rights</th></tr></thead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No customers registered yet.</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.email ?? '-'} {c.phone ? `(${c.phone})` : ''}</td>
                <td>{c.has_document ? <span className="badge badge-info"><Lock size={11} /> AES-256 Encrypted</span> : <span className="badge badge-neutral">None</span>}</td>
                <td>{c.is_anonymized ? <span className="badge badge-danger">Anonymized (Art. 18)</span> : <span className="badge badge-success">Active Consent</span>}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleExport(c.id)}><Download size={13} /> Export JSON</button>
                  {!c.is_anonymized && <button type="button" className="btn btn-danger btn-sm" onClick={() => handleAnonymize(c)}><UserX size={13} /> Anonymize</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
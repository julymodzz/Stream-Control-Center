import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requiresTotp, setRequiresTotp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await login(username, password, totpCode || undefined);
      setAuth(result.tokens.accessToken, result.user);
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen';
      const needsTotp = (err as Error & { requiresTotp?: boolean }).requiresTotp;
      if (needsTotp) setRequiresTotp(true);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="mb-2 text-4xl">📡</div>
          <h1 className="text-xl font-bold">Stream Control Center</h1>
          <p className="text-sm text-gray-500">Sichere Anmeldung erforderlich</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
        )}

        <div>
          <label className="mb-1 block text-xs text-gray-500">Benutzername</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-gray-600 bg-surface px-3 py-2 text-sm"
            required
            autoComplete="username"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Passwort</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-600 bg-surface px-3 py-2 text-sm"
            required
            autoComplete="current-password"
          />
        </div>

        {requiresTotp && (
          <div>
            <label className="mb-1 block text-xs text-gray-500">2FA-Code</label>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-surface px-3 py-2 text-sm"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Anmelden…' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
}

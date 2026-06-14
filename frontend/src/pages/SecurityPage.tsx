import { useEffect, useState } from 'react';
import { Key, Monitor, Shield } from 'lucide-react';
import {
  changePassword,
  createApiToken,
  disableTotp,
  enableTotp,
  fetchApiTokens,
  fetchSessions,
  revokeApiToken,
  revokeOtherSessions,
  revokeSession,
  setupTotp,
  validatePassword,
} from '../api/client';
import { PasswordStrengthMeter } from '../components/iam/PasswordStrengthMeter';
import { SessionManager } from '../components/iam/SessionManager';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input, Label } from '../components/ui/input';
import { ApiToken, PasswordValidation, UserSession } from '../types';

export function SecurityPage() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [validation, setValidation] = useState<PasswordValidation | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [totpQr, setTotpQr] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    const [s, t] = await Promise.all([fetchSessions(), fetchApiTokens()]);
    setSessions(s ?? []);
    setTokens(t ?? []);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (newPw.length > 0) {
      validatePassword(newPw).then(setValidation).catch(() => setValidation(null));
    } else {
      setValidation(null);
    }
  }, [newPw]);

  const handleChangePassword = async () => {
    await changePassword(currentPw, newPw);
    setMessage('Passwort geändert');
    setCurrentPw('');
    setNewPw('');
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Shield className="h-6 w-6 text-accent-blue" />
          Sicherheit
        </h1>
        <p className="text-sm text-gray-500">Passwort, 2FA, Sitzungen und API-Tokens</p>
      </div>

      {message && <div className="rounded-lg bg-green-500/10 px-4 py-2 text-sm text-green-400">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Key className="h-4 w-4" /> Passwort ändern</CardTitle>
            <CardDescription>Min. 12 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Aktuelles Passwort</Label><Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} /></div>
            <div>
              <Label>Neues Passwort</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              <PasswordStrengthMeter password={newPw} score={validation?.score} errors={validation?.errors} />
            </div>
            <Button onClick={handleChangePassword} disabled={!validation?.valid}>Passwort ändern</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Zwei-Faktor-Authentifizierung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!totpQr ? (
              <Button variant="outline" onClick={() => setupTotp().then((r) => setTotpQr(r.qrCode))}>2FA einrichten</Button>
            ) : (
              <>
                <img src={totpQr} alt="TOTP QR" className="mx-auto h-40 w-40 rounded-lg bg-white p-2" />
                <Input placeholder="6-stelliger Code" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
                <Button onClick={() => enableTotp(totpCode).then((r) => { setBackupCodes(r.backupCodes); setTotpQr(null); })}>2FA aktivieren</Button>
              </>
            )}
            {backupCodes.length > 0 && (
              <div className="rounded-lg bg-yellow-500/10 p-3">
                <p className="mb-2 text-xs text-yellow-400">Backup-Codes (einmalig anzeigen):</p>
                <div className="grid grid-cols-2 gap-1 font-mono text-xs">{backupCodes.map((c) => <span key={c}>{c}</span>)}</div>
              </div>
            )}
            <Button variant="destructive" size="sm" onClick={() => disableTotp(totpCode)}>2FA deaktivieren</Button>
          </CardContent>
        </Card>
      </div>

      <SessionManager
        sessions={sessions}
        onRevoke={(id) => revokeSession(id).then(load)}
        onRevokeOthers={() => revokeOtherSessions().then(load)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Monitor className="h-4 w-4" /> API Tokens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Token-Name" value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} />
            <Button onClick={() => createApiToken(newTokenName).then((r) => { setRawToken(r.rawToken); load(); })}>Erstellen</Button>
          </div>
          {rawToken && (
            <div className="rounded-lg bg-accent-blue/10 p-3 font-mono text-xs break-all">
              Token (nur einmal sichtbar): {rawToken}
            </div>
          )}
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-700/50 px-3 py-2">
              <div>
                <span className="font-medium">{t.name}</span>
                <Badge variant="outline" className="ml-2">{t.tokenPrefix}…</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => revokeApiToken(t.id).then(load)}>Widerrufen</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

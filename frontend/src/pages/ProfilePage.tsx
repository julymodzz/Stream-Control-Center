import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { fetchProfile, updateProfile } from '../api/client';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/input';
import { UserPublic } from '../types';
import { useAuthStore } from '../store/useAuthStore';

export function ProfilePage() {
  const [profile, setProfile] = useState<UserPublic | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const authUser = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchProfile().then((r) => {
      setProfile(r?.user ?? null);
      setDisplayName(r?.user?.displayName ?? '');
      setEmail(r?.user?.email ?? '');
    }).catch(() => setProfile(null));
  }, []);

  const handleSave = async () => {
    const updated = await updateProfile({ displayName, email });
    setProfile(updated);
  };

  if (!profile) {
    return <div className="p-6 text-gray-500">Profil wird geladen…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <User className="h-6 w-6 text-accent-blue" />
        Profil
      </h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-blue/20 text-2xl font-bold text-accent-blue">
              {profile.displayName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <CardTitle>{profile.displayName}</CardTitle>
              <p className="text-sm text-gray-500">@{profile.username}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-gray-500">Benutzername</Label>
              <p className="text-sm">{profile.username}</p>
            </div>
            <div>
              <Label className="text-gray-500">Rolle</Label>
              <Badge variant="outline">{profile.roleName ?? authUser?.roleName}</Badge>
            </div>
            <div>
              <Label className="text-gray-500">Letzter Login</Label>
              <p className="text-sm">{profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString('de-DE') : '–'}</p>
            </div>
            <div>
              <Label className="text-gray-500">Konto erstellt</Label>
              <p className="text-sm">{new Date(profile.createdAt).toLocaleDateString('de-DE')}</p>
            </div>
            <div>
              <Label className="text-gray-500">2FA</Label>
              <p className="text-sm">{profile.totpEnabled ? 'Aktiviert' : 'Deaktiviert'}</p>
            </div>
          </div>

          <hr className="border-gray-700" />

          <div><Label>Anzeigename</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div><Label>E-Mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <Button onClick={handleSave}>Speichern</Button>
        </CardContent>
      </Card>
    </div>
  );
}

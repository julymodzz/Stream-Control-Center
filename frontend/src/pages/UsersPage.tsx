import { useEffect, useState } from 'react';
import { Plus, Search, Shield, UserCog } from 'lucide-react';
import {
  createUser,
  deleteUser,
  disableUser,
  enableUser,
  fetchRoles,
  fetchUsers,
  resetUser2fa,
} from '../api/client';
import { PasswordStrengthMeter } from '../components/iam/PasswordStrengthMeter';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input, Label } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Role, UserPublic, UserStatus } from '../types';
import { useAuthStore } from '../store/useAuthStore';

const STATUS_VARIANT: Record<UserStatus, 'success' | 'destructive' | 'warning'> = {
  active: 'success',
  disabled: 'destructive',
  locked: 'warning',
};

export function UsersPage() {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', displayName: '', email: '', password: '', roleId: '' });
  const canCreate = useAuthStore((s) => s.hasPermission('users.create'));
  const canEdit = useAuthStore((s) => s.hasPermission('users.edit'));

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.query = search;
      if (statusFilter) params.status = statusFilter;
      if (roleFilter) params.roleSlug = roleFilter;
      const [u, r] = await Promise.all([fetchUsers(params), fetchRoles()]);
      setUsers(u ?? []);
      setRoles(r ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    await createUser({ ...newUser, mustChangePassword: true });
    setShowCreate(false);
    setNewUser({ username: '', displayName: '', email: '', password: '', roleId: '' });
    load();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <UserCog className="h-6 w-6 text-accent-blue" />
            Benutzer
          </h1>
          <p className="text-sm text-gray-500">Benutzerverwaltung und Zugriffssteuerung</p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.href = '/roles'}>Rollen verwalten</Button>
            <Button onClick={() => setShowCreate(!showCreate)}>
              <Plus className="h-4 w-4" /> Benutzer erstellen
            </Button>
          </div>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Neuer Benutzer</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><Label>Benutzername</Label><Input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} /></div>
            <div><Label>Anzeigename</Label><Input value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })} /></div>
            <div><Label>E-Mail</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
            <div>
              <Label>Rolle</Label>
              <select className="flex h-9 w-full rounded-lg border border-gray-600 bg-surface px-3 text-sm" value={newUser.roleId} onChange={(e) => setNewUser({ ...newUser, roleId: e.target.value })}>
                <option value="">Rolle wählen</option>
                {roles.filter((r) => r.slug !== 'super_admin' || useAuthStore.getState().user?.roleSlug === 'super_admin').map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Passwort</Label>
              <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              <PasswordStrengthMeter password={newUser.password} />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button onClick={handleCreate}>Erstellen</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <Input className="pl-9" placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
            </div>
            <select className="h-9 rounded-lg border border-gray-600 bg-surface px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}>
              <option value="">Alle Status</option>
              <option value="active">Aktiv</option>
              <option value="disabled">Deaktiviert</option>
              <option value="locked">Gesperrt</option>
            </select>
            <select className="h-9 rounded-lg border border-gray-600 bg-surface px-3 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">Alle Rollen</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button variant="outline" size="sm" onClick={load}>Filtern</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <p className="p-5 text-gray-500">Laden…</p>
          ) : users.length === 0 ? (
            <p className="p-5 text-gray-500">Keine Benutzer gefunden</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Benutzer</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead>Letzter Login</TableHead>
                  <TableHead>Erstellt</TableHead>
                  {canEdit && <TableHead>Aktionen</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.displayName}</div>
                      <div className="text-xs text-gray-500">@{u.username}</div>
                    </TableCell>
                    <TableCell className="text-gray-400">{u.email || '–'}</TableCell>
                    <TableCell><Badge variant="outline">{u.roleName ?? u.roleSlug}</Badge></TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[u.status]}>{u.status}</Badge></TableCell>
                    <TableCell>{u.totpEnabled ? <Shield className="h-4 w-4 text-green-400" /> : '–'}</TableCell>
                    <TableCell className="text-xs text-gray-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('de-DE') : '–'}</TableCell>
                    <TableCell className="text-xs text-gray-500">{new Date(u.createdAt).toLocaleDateString('de-DE')}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          {u.status === 'active' ? (
                            <Button variant="ghost" size="sm" onClick={() => disableUser(u.id).then(load)}>Deaktivieren</Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => enableUser(u.id).then(load)}>Aktivieren</Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => resetUser2fa(u.id).then(load)}>2FA Reset</Button>
                          <Button variant="ghost" size="sm" className="text-red-400" onClick={() => deleteUser(u.id).then(load)}>Löschen</Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

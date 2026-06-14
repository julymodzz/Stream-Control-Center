import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { createRole, deleteRole, fetchAllPermissions, fetchRoles, updateRole } from '../api/client';
import { PermissionMatrix } from '../components/iam/PermissionMatrix';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Role } from '../types';
import { useAuthStore } from '../store/useAuthStore';

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const canManage = useAuthStore((s) => s.hasPermission('roles.manage'));

  const load = async () => {
    const [r, p] = await Promise.all([fetchRoles(), fetchAllPermissions()]);
    setRoles(r ?? []);
    setPermissions(p ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    if (editing.id) {
      await updateRole(editing.id, { name: editing.name, description: editing.description, permissions: editing.permissions });
    } else if (editing.slug) {
      await createRole({ name: editing.name, slug: editing.slug, description: editing.description, permissions: editing.permissions });
    }
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Shield className="h-6 w-6 text-accent-blue" />
            Rollen
          </h1>
          <p className="text-sm text-gray-500">Rollen und Berechtigungen verwalten</p>
        </div>
        {canManage && (
          <Button onClick={() => setEditing({ id: '', name: '', slug: '', description: '', permissions: [], isSystem: false, createdAt: '', updatedAt: '' } as Role)}>
            Rolle erstellen
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0 pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rolle</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Benutzer</TableHead>
                <TableHead>Typ</TableHead>
                {canManage && <TableHead>Aktionen</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-gray-400">{r.description}</TableCell>
                  <TableCell>{r.userCount ?? 0}</TableCell>
                  <TableCell><Badge variant={r.isSystem ? 'outline' : 'default'}>{r.isSystem ? 'System' : 'Custom'}</Badge></TableCell>
                  {canManage && (
                    <TableCell>
                      {!r.isSystem && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Bearbeiten</Button>
                          <Button variant="ghost" size="sm" className="text-red-400" onClick={() => deleteRole(r.id).then(load)}>Löschen</Button>
                        </div>
                      )}
                      {r.isSystem && <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Anzeigen</Button>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader><CardTitle>{editing.id ? `Rolle: ${editing.name}` : 'Neue Rolle'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!editing.id && (
              <>
                <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="custom_role" /></div>
              </>
            )}
            <div><Label>Beschreibung</Label><Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} disabled={editing.isSystem} /></div>
            <PermissionMatrix
              allPermissions={permissions}
              selected={editing.permissions}
              onChange={(p) => setEditing({ ...editing, permissions: p })}
              readOnly={editing.isSystem || !canManage}
            />
            <div className="flex gap-2">
              {canManage && !editing.isSystem && <Button onClick={handleSave}>Speichern</Button>}
              <Button variant="outline" onClick={() => setEditing(null)}>Schließen</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface PermissionMatrixProps {
  allPermissions: string[];
  selected: string[];
  onChange: (permissions: string[]) => void;
  readOnly?: boolean;
}

const GROUPS: Record<string, string[]> = {
  Benutzer: ['users.create', 'users.edit', 'users.delete', 'users.view', 'users.reset_password', 'users.change_role', 'users.disable', 'users.reset_2fa'],
  Dashboard: ['dashboard.view', 'monitoring.view', 'logs.view'],
  Steuerung: ['obs.control', 'noalbs.control'],
  Alerts: ['alerts.view', 'alerts.manage'],
  System: ['audit.view', 'audit.delete', 'settings.manage', 'settings.view', 'roles.manage', 'roles.view', 'backup.view', 'backup.manage'],
  Sicherheit: ['api_tokens.manage', 'sessions.manage', 'profile.edit'],
};

export function PermissionMatrix({ allPermissions, selected, onChange, readOnly }: PermissionMatrixProps) {
  const toggle = (perm: string) => {
    if (readOnly) return;
    onChange(selected.includes(perm) ? selected.filter((p) => p !== perm) : [...selected, perm]);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-400">Berechtigungen</h4>
      {Object.entries(GROUPS).map(([group, perms]) => (
        <div key={group}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">{group}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {perms.filter((p) => allPermissions.includes(p)).map((perm) => (
              <label key={perm} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-700/50 px-3 py-2 text-sm hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={selected.includes(perm)}
                  onChange={() => toggle(perm)}
                  disabled={readOnly}
                  className="rounded border-gray-600"
                />
                <span className="font-mono text-xs">{perm}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

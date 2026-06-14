import { spawn } from 'child_process';
import { config } from '../config/env';

export class ShellError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly stderr?: string,
    public readonly exitCode?: number
  ) {
    super(message);
    this.name = 'ShellError';
  }
}

const ALLOWED_SERVICES = new Set([
  config.obs.serviceName,
  config.noalbs.serviceName,
]);

const SYSTEMCTL_ACTIONS = new Set(['start', 'stop', 'restart', 'is-active']);

function validateServiceName(serviceName: string): void {
  if (!ALLOWED_SERVICES.has(serviceName)) {
    throw new ShellError(
      `Dienst "${serviceName}" ist nicht in der Allowlist`,
      'systemctl',
      undefined,
      403
    );
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(serviceName)) {
    throw new ShellError('Ungültiger Dienstname', 'systemctl');
  }
}

/**
 * Führt einen vordefinierten Befehl ohne Shell-Interpretation aus.
 * Keine benutzerdefinierten Befehle – nur feste Argumentlisten.
 */
export function runArgv(
  command: string,
  args: string[],
  timeoutMs = 30000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      timeout: timeoutMs,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new ShellError(err.message, `${command} ${args.join(' ')}`, stderr));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new ShellError(
            `Befehl fehlgeschlagen (exit ${code})`,
            `${command} ${args.join(' ')}`,
            stderr.trim(),
            code ?? undefined
          )
        );
      }
    });
  });
}

export async function systemctl(
  action: 'start' | 'stop' | 'restart' | 'is-active',
  serviceName: string,
  timeoutMs = 30000
): Promise<string> {
  if (!SYSTEMCTL_ACTIONS.has(action)) {
    throw new ShellError(`Ungültige systemctl-Aktion: ${action}`, 'systemctl');
  }
  validateServiceName(serviceName);
  return runArgv('systemctl', [action, serviceName], timeoutMs);
}

export async function sudoSystemctl(
  action: 'start' | 'stop' | 'restart',
  serviceName: string,
  timeoutMs = 30000
): Promise<string> {
  validateServiceName(serviceName);
  return runArgv('sudo', ['systemctl', action, serviceName], timeoutMs);
}

export async function trySystemctlIsActive(serviceName: string): Promise<boolean> {
  try {
    const out = await systemctl('is-active', serviceName, 5000);
    return out.trim() === 'active';
  } catch {
    return false;
  }
}

export async function pingHost(
  host: string,
  timeoutMs: number
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  if (!/^[\w.-]+$/.test(host)) {
    return { success: false, stdout: '', stderr: 'Ungültiger Hostname' };
  }

  try {
    const stdout = await runArgv('ping', ['-c', '1', '-W', String(Math.ceil(timeoutMs / 1000)), host], timeoutMs + 2000);
    return { success: true, stdout, stderr: '' };
  } catch (error) {
    if (error instanceof ShellError) {
      return { success: false, stdout: '', stderr: error.stderr || error.message };
    }
    return { success: false, stdout: '', stderr: String(error) };
  }
}

export async function scheduleReboot(): Promise<string> {
  return runArgv('sudo', [
    'shutdown',
    '-r',
    '+1',
    'Stream Control Center: Server-Neustart in 1 Minute',
  ], 10000);
}

/** @deprecated Nur für Abwärtskompatibilität in Tests – nicht für Benutzereingaben */
export async function tryCommand(
  command: string,
  timeoutMs = 10000
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const parts = command.split(/\s+/);
  const bin = parts[0];
  const args = parts.slice(1);

  const allowedBins = new Set(['systemctl', 'pgrep', 'ping']);
  if (!allowedBins.has(bin)) {
    return { success: false, stdout: '', stderr: 'Befehl nicht erlaubt' };
  }

  if (bin === 'systemctl' && args.length >= 2) {
    const action = args[0];
    const service = args[1];
    if (!SYSTEMCTL_ACTIONS.has(action)) {
      return { success: false, stdout: '', stderr: 'Aktion nicht erlaubt' };
    }
    try {
      validateServiceName(service);
      const stdout = await runArgv('systemctl', args, timeoutMs);
      return { success: true, stdout, stderr: '' };
    } catch (error) {
      if (error instanceof ShellError) {
        return { success: false, stdout: '', stderr: error.stderr || error.message };
      }
      return { success: false, stdout: '', stderr: String(error) };
    }
  }

  return { success: false, stdout: '', stderr: 'Befehl nicht erlaubt' };
}

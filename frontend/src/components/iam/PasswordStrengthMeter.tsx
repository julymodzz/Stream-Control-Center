import { cn } from '../../lib/utils';

interface PasswordStrengthMeterProps {
  password: string;
  score?: number;
  errors?: string[];
}

function calcScore(password: string): number {
  let score = 0;
  if (password.length >= 12) score += 25;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 15;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score += 20;
  if (password.length >= 16) score += 10;
  return Math.min(100, score);
}

export function PasswordStrengthMeter({ password, score, errors }: PasswordStrengthMeterProps) {
  const s = score ?? calcScore(password);
  const color = s < 40 ? 'bg-red-500' : s < 70 ? 'bg-yellow-500' : 'bg-green-500';
  const label = s < 40 ? 'Schwach' : s < 70 ? 'Mittel' : 'Stark';

  if (!password) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Passwortstärke</span>
        <span className={s < 40 ? 'text-red-400' : s < 70 ? 'text-yellow-400' : 'text-green-400'}>{label}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
        <div className={cn('h-full transition-all duration-300', color)} style={{ width: `${s}%` }} />
      </div>
      {errors && errors.length > 0 && (
        <ul className="text-xs text-red-400">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

import bcrypt from 'bcryptjs';
import { config } from '../config/env';

export interface PasswordValidationResult {
  valid: boolean;
  score: number;
  errors: string[];
  suggestions: string[];
}

const PASSWORD_RULES = {
  minLength: 12,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSpecial: true,
  historyCount: 5,
};

export class PasswordService {
  validate(password: string): PasswordValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];
    let score = 0;

    if (password.length < PASSWORD_RULES.minLength) {
      errors.push(`Mindestens ${PASSWORD_RULES.minLength} Zeichen erforderlich`);
    } else {
      score += 25;
      if (password.length >= 16) score += 10;
    }

    if (PASSWORD_RULES.requireUpper && !/[A-Z]/.test(password)) {
      errors.push('Mindestens ein Großbuchstabe erforderlich');
    } else score += 15;

    if (PASSWORD_RULES.requireLower && !/[a-z]/.test(password)) {
      errors.push('Mindestens ein Kleinbuchstabe erforderlich');
    } else score += 15;

    if (PASSWORD_RULES.requireNumber && !/\d/.test(password)) {
      errors.push('Mindestens eine Zahl erforderlich');
    } else score += 15;

    if (PASSWORD_RULES.requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Mindestens ein Sonderzeichen erforderlich');
    } else score += 20;

    if (score < 60) suggestions.push('Verwenden Sie eine längere Passphrase mit gemischten Zeichen');

    return { valid: errors.length === 0, score: Math.min(100, score), errors, suggestions };
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async isInHistory(password: string, history: string[]): Promise<boolean> {
    for (const oldHash of history.slice(0, PASSWORD_RULES.historyCount)) {
      if (await bcrypt.compare(password, oldHash)) return true;
    }
    return false;
  }

  addToHistory(currentHash: string, history: string[]): string[] {
    return [currentHash, ...history].slice(0, PASSWORD_RULES.historyCount);
  }

  isExpired(passwordChangedAt: string | undefined): boolean {
    if (!config.auth.passwordExpiresDays) return false;
    if (!passwordChangedAt) return false;
    const expiresMs = config.auth.passwordExpiresDays * 86400000;
    return Date.now() - new Date(passwordChangedAt).getTime() > expiresMs;
  }
}

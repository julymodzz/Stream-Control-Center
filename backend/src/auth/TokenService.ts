import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '../config/env';
import { AuthTokens, JwtPayload, User } from '../types';
import { Permission } from '../iam/permissions';

interface RefreshTokenRecord {
  tokenId: string;
  userId: string;
  sessionId: string;
  expiresAt: string;
  revoked: boolean;
}

export class TokenService {
  private refreshTokens = new Map<string, RefreshTokenRecord>();

  createAccessToken(
    user: Pick<User, 'id' | 'username' | 'roleId'>,
    roleSlug: string,
    permissions: Permission[],
    sessionId?: string
  ): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      roleId: user.roleId,
      roleSlug,
      permissions,
      sessionId,
      type: 'access',
    };
    return jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: config.auth.jwtAccessExpires as jwt.SignOptions['expiresIn'],
    });
  }

  createRefreshToken(userId: string, sessionId: string): { token: string; tokenId: string } {
    const tokenId = randomUUID();
    const expiresAt = new Date(
      Date.now() + this.parseDurationMs(config.auth.jwtRefreshExpires)
    ).toISOString();

    this.refreshTokens.set(tokenId, { tokenId, userId, sessionId, expiresAt, revoked: false });

    const token = jwt.sign({ sub: userId, jti: tokenId, sid: sessionId, type: 'refresh' }, config.auth.jwtSecret, {
      expiresIn: config.auth.jwtRefreshExpires as jwt.SignOptions['expiresIn'],
    });
    return { token, tokenId };
  }

  issueTokens(
    user: Pick<User, 'id' | 'username' | 'roleId'>,
    roleSlug: string,
    permissions: Permission[],
    sessionId?: string
  ): AuthTokens {
    const accessToken = this.createAccessToken(user, roleSlug, permissions, sessionId);
    const expiresIn = this.parseDurationMs(config.auth.jwtAccessExpires) / 1000;
    return { accessToken, expiresIn };
  }

  verifyAccessToken(token: string): JwtPayload | null {
    try {
      const payload = jwt.verify(token, config.auth.jwtSecret) as JwtPayload & { type?: string };
      if (payload.type !== 'access') return null;
      return payload;
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): { userId: string; tokenId: string; sessionId: string } | null {
    try {
      const payload = jwt.verify(token, config.auth.jwtSecret) as {
        sub: string;
        jti: string;
        sid?: string;
        type?: string;
      };
      if (payload.type !== 'refresh' || !payload.jti) return null;

      const record = this.refreshTokens.get(payload.jti);
      if (!record || record.revoked || new Date(record.expiresAt) < new Date()) {
        return null;
      }
      return { userId: payload.sub, tokenId: payload.jti, sessionId: record.sessionId };
    } catch {
      return null;
    }
  }

  revokeRefreshToken(tokenId: string): void {
    const record = this.refreshTokens.get(tokenId);
    if (record) record.revoked = true;
  }

  revokeAllForUser(userId: string): void {
    for (const record of this.refreshTokens.values()) {
      if (record.userId === userId) record.revoked = true;
    }
  }

  getRefreshTokenId(tokenId: string): string | undefined {
    return this.refreshTokens.get(tokenId)?.tokenId;
  }

  private parseDurationMs(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 900000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[unit] || 60000);
  }
}

import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  async generateQrCode(username: string, secret: string, issuer = 'StreamControlCenter'): Promise<string> {
    const otpauth = authenticator.keyuri(username, issuer, secret);
    return QRCode.toDataURL(otpauth);
  }

  verify(token: string, secret: string): boolean {
    try {
      return authenticator.verify({ token: token.replace(/\s/g, ''), secret });
    } catch {
      return false;
    }
  }
}

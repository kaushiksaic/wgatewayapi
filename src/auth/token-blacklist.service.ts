import { Injectable } from '@nestjs/common';

/** In-memory revoked JWT ids (jti). Use Redis in production for multi-instance. */
@Injectable()
export class TokenBlacklistService {
  private readonly revoked = new Set<string>();

  revoke(jti: string) {
    this.revoked.add(jti);
  }

  isRevoked(jti: string | undefined): boolean {
    if (!jti) return false;
    return this.revoked.has(jti);
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Reads ERP integration secret from X-Api-Key or Authorization: Bearer */
export function extractErpApiKey(request: Request): string | undefined {
  const header = request.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }
  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return undefined;
}

@Injectable()
export class ErpApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ERP_API_KEY');
    if (!expected) {
      throw new UnauthorizedException(
        'ERP API key is not configured on the gateway server',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = extractErpApiKey(request);
    if (!provided || !safeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid or missing ERP API key');
    }
    return true;
  }
}

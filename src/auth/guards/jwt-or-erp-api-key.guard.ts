import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { extractErpApiKey } from './erp-api-key.guard';
import { timingSafeEqual } from 'crypto';

function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Allows portal users (JWT) or external ERP systems (ERP_API_KEY).
 * ERP key is checked first so it is not mistaken for a JWT.
 */
@Injectable()
export class JwtOrErpApiKeyGuard extends AuthGuard('jwt') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>('ERP_API_KEY');
    const provided = extractErpApiKey(request);

    if (expected && provided && safeEqual(provided, expected)) {
      return true;
    }

    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      throw new UnauthorizedException(
        'Provide a valid admin JWT or ERP API key (X-Api-Key header)',
      );
    }
  }
}

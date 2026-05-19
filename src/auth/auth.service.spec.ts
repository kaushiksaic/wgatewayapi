import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { TokenBlacklistService } from './token-blacklist.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        TokenBlacklistService,
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('test-token') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should hash passwords with bcrypt', () => {
    const hash = service.hashPassword('test123');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('should revoke token on logout', () => {
    const blacklist = new TokenBlacklistService();
    blacklist.revoke('test-jti');
    expect(blacklist.isRevoked('test-jti')).toBe(true);
  });
});

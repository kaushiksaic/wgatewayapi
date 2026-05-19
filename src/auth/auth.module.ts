import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { TokenBlacklistService } from './token-blacklist.service';
import { ErpApiKeyGuard } from './guards/erp-api-key.guard';
import { JwtOrErpApiKeyGuard } from './guards/jwt-or-erp-api-key.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'wgateway-dev-secret-change-me',
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    TokenBlacklistService,
    ErpApiKeyGuard,
    JwtOrErpApiKeyGuard,
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    TokenBlacklistService,
    ErpApiKeyGuard,
    JwtOrErpApiKeyGuard,
  ],
})
export class AuthModule {}

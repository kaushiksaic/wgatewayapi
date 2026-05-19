import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import * as sql from 'mssql';
import { LoginDto } from './dto/login.dto';
import { TokenBlacklistService } from './token-blacklist.service';

const MAX_FAILED_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {}

  async login(loginDto: LoginDto) {
    const pool = await sql.connect();

    try {
      const result = await pool
        .request()
        .input('Login', sql.VarChar, loginDto.username.trim())
        .query(`
          SELECT TOP 1
            AdminUserId,
            FullName,
            Email,
            Username,
            PasswordHash,
            RoleName,
            IsActive,
            IsLocked,
            FailedLoginAttempts
          FROM AdminUsers
          WHERE Username = @Login OR Email = @Login
        `);

      if (result.recordset.length === 0) {
        return {
          success: false,
          message: 'Invalid username or password',
        };
      }

      const admin = result.recordset[0];

      if (!admin.IsActive) {
        return {
          success: false,
          message: 'Account is inactive. Contact administrator.',
        };
      }

      if (admin.IsLocked) {
        return {
          success: false,
          message: 'Account is locked due to failed login attempts.',
        };
      }

      const passwordValid = await bcrypt.compare(
        loginDto.password,
        admin.PasswordHash,
      );

      if (!passwordValid) {
        await pool
          .request()
          .input('AdminUserId', sql.BigInt, admin.AdminUserId)
          .query(`
            UPDATE AdminUsers
            SET
              FailedLoginAttempts = FailedLoginAttempts + 1,
              IsLocked = CASE
                WHEN FailedLoginAttempts + 1 >= ${MAX_FAILED_ATTEMPTS} THEN 1
                ELSE IsLocked
              END,
              UpdatedAt = GETDATE()
            WHERE AdminUserId = @AdminUserId
          `);

        return {
          success: false,
          message: 'Invalid username or password',
        };
      }

      await pool
        .request()
        .input('AdminUserId', sql.BigInt, admin.AdminUserId)
        .query(`
          UPDATE AdminUsers
          SET
            FailedLoginAttempts = 0,
            LastLoginAt = GETDATE(),
            UpdatedAt = GETDATE()
          WHERE AdminUserId = @AdminUserId
        `);

      const jti = randomUUID();
      const accessToken = await this.jwtService.signAsync({
        sub: admin.AdminUserId,
        username: admin.Username,
        email: admin.Email,
        role: admin.RoleName,
        jti,
      });

      return {
        success: true,
        message: 'Login successful',
        accessToken,
        user: {
          adminUserId: Number(admin.AdminUserId),
          fullName: admin.FullName,
          email: admin.Email,
          username: admin.Username,
          roleName: admin.RoleName,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  logout(jti?: string) {
    if (jti) {
      this.tokenBlacklist.revoke(jti);
    }
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  /** Use when seeding AdminUsers — stores bcrypt hash, not plain text */
  hashPassword(plainPassword: string): string {
    return bcrypt.hashSync(plainPassword, 10);
  }
}

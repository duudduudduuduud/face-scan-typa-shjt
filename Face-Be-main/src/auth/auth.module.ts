import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || Buffer.byteLength(secret) < 32)
          throw new Error(
            'JWT_SECRET must contain at least 32 bytes; configure it in .env',
          );
        return {
          secret,
          signOptions: {
            algorithm: 'HS256' as const,
            expiresIn: 3600,
            issuer: 'faceid-api',
            audience: 'faceid-clients',
          },
          verifyOptions: {
            algorithms: ['HS256' as const],
            issuer: 'faceid-api',
            audience: 'faceid-clients',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}

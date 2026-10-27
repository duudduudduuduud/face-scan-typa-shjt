import { ROLES, type Role } from './roles';
import { ForbiddenException } from '@nestjs/common';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { UserResponse } from './auth.dto';
import { PUBLIC_ROUTE } from './public.decorator';
export interface AuthRequest extends Request { user: UserResponse }
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Bearer token is required');
    let id: number;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(match[1]);
      id = Number(payload.sub);
      if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid subject');
    } catch { throw new UnauthorizedException('Invalid or expired token'); }
    request.user = await this.auth.findUser(id);
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [context.getHandler(), context.getClass()]);
    if (roles && !roles.includes(request.user.role)) throw new ForbiddenException('Your role cannot access this operation');
    return true;
  }
}

import { SetMetadata } from '@nestjs/common';
export const ROLES = 'faceid:roles';
export const ROLE_VALUES = ['admin', 'teacher', 'student', 'ai_service'] as const;
export type Role = typeof ROLE_VALUES[number];
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

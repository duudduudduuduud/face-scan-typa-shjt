import type { Role } from './roles';
import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { object, text } from '../common/validation';
export class LoginBody {
  @ApiProperty({ example: 'teacher01', minLength: 3, maxLength: 50 })
  username: string;
  @ApiProperty({
    example: 'MyPassword123!',
    minLength: 8,
    maxLength: 128,
    format: 'password',
  })
  password: string;
}
export class RegisterBody extends LoginBody {
  @ApiProperty({ example: 'Nguyễn Văn A', maxLength: 200 }) fullName: string;
}
export interface Account {
  role: Role;
  studentId?: number;
  id: number;
  username: string;
  fullName: string;
}
export class UserResponse implements Account {
  @ApiProperty({ enum: ['admin', 'teacher', 'student', 'ai_service'] }) role: Role;
  @ApiProperty({ required: false }) studentId?: number;
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'teacher01' }) username: string;
  @ApiProperty({ example: 'Nguyễn Văn A' }) fullName: string;
}
export class LoginResponse {
  @ApiProperty() accessToken: string;
  @ApiProperty({ example: 'Bearer' }) tokenType: string;
  @ApiProperty({ example: 3600 }) expiresIn: number;
  @ApiProperty({ type: UserResponse }) user: UserResponse;
}
export function parseCredentials(
  body: unknown,
  register = false,
): LoginBody & { fullName?: string } {
  const data = object(
    body,
    register ? ['username', 'password', 'fullName'] : ['username', 'password'],
  );
  const username = text(data.username, 'username', 50).toLowerCase();
  if (!/^[a-z0-9_]{3,50}$/.test(username))
    throw new BadRequestException(
      'username must contain 3-50 letters, digits or underscores',
    );
  if (
    typeof data.password !== 'string' ||
    data.password.length < 8 ||
    data.password.length > 128 ||
    !data.password.trim()
  )
    throw new BadRequestException('password must contain 8-128 characters');
  return {
    username,
    password: data.password,
    ...(register ? { fullName: text(data.fullName, 'fullName') } : {}),
  };
}

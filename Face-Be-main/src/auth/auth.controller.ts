import { Roles } from './roles';
import { object, positiveInteger } from '../common/validation';
import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginBody,
  LoginResponse,
  RegisterBody,
  UserResponse,
  parseCredentials,
} from './auth.dto';
import type { AuthRequest } from './auth.guard';
import { Public } from './public.decorator';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Post('register')
  // Public registration always creates a teacher; student accounts use the guarded endpoint.
  @ApiOperation({ summary: 'Đăng ký tài khoản' })
  @ApiBody({ type: RegisterBody })
  @ApiCreatedResponse({ type: UserResponse })
  @ApiBadRequestResponse({
    description: 'Dữ liệu không hợp lệ.',
  })
  @ApiConflictResponse({ description: 'Tên đăng nhập đã tồn tại.' })
  register(@Body() body: unknown) {
    const data = parseCredentials(body, true);
    return this.auth.register({
      username: data.username,
      password: data.password,
      fullName: data.fullName!,
    });
  }
  @Roles('teacher', 'admin')
  @Get('student-accounts/available-students')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sinh viên chưa được cấp tài khoản' })
  availableStudents() {
    return this.auth.availableStudents();
  }
  @Roles('teacher', 'admin')
  @Post('student-accounts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Teacher creates an account linked to an existing student' })
  @ApiBody({ schema: { type: 'object', required: ['username','password','fullName','studentId'], properties: { username: {type:'string'}, password:{type:'string',format:'password'}, fullName:{type:'string'}, studentId:{type:'integer',minimum:1} } } })
  @ApiCreatedResponse({ type: UserResponse })
  createStudent(@Body() body: unknown, @Req() request: AuthRequest) {
    const value = object(body, ['username','password','fullName','studentId']);
    const data = parseCredentials({ username: value.username, password: value.password, fullName: value.fullName }, true);
    return this.auth.register({ username: data.username, password: data.password, fullName: data.fullName! }, request.headers.authorization, positiveInteger(value.studentId, 'studentId'));
  }
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập và lấy accessToken' })
  @ApiBody({ type: LoginBody })
  @ApiOkResponse({ type: LoginResponse })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ.' })
  @ApiUnauthorizedResponse({ description: 'Sai tên đăng nhập hoặc mật khẩu.' })
  login(@Body() body: unknown) {
    return this.auth.login(parseCredentials(body));
  }
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thông tin tài khoản đang đăng nhập' })
  @ApiOkResponse({ type: UserResponse })
  @ApiUnauthorizedResponse({
    description: 'Token thiếu, không hợp lệ hoặc hết hạn.',
  })
  me(@Req() request: AuthRequest) {
    return request.user;
  }
}

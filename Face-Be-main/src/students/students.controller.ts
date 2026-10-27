import { Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.guard';
import { Roles } from '../auth/roles';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Patch,
  Param,
} from '@nestjs/common';
import { positiveInteger } from '../common/validation';
import { knownIdentity } from '../common/validation';
import { parseStudent } from './students.dto';
import { StudentsService } from './students.service';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateStudentBody, StudentResponse } from '../docs/api-models';
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Bearer token thiếu, không hợp lệ hoặc hết hạn.',
})
@Controller('students')
@ApiTags('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}
  @Roles('admin', 'teacher')
  @Post()
  @ApiOperation({ summary: 'Tạo sinh viên' })
  @ApiBody({ type: CreateStudentBody })
  @ApiCreatedResponse({ type: StudentResponse })
  @ApiBadRequestResponse({
    description: 'Dữ liệu không hợp lệ hoặc danh tính unknown.',
  })
  @ApiConflictResponse({ description: 'Mã sinh viên đã tồn tại.' })
  create(@Body() body: unknown) {
    return this.students.create(parseStudent(body));
  }
  @Roles('admin', 'teacher')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update student code and name',
  })
  @ApiBody({ type: CreateStudentBody })
  @ApiOkResponse({ type: StudentResponse })
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.students.update(
      positiveInteger(id, 'id', true),
      parseStudent(body),
    );
  }
  @Roles('admin', 'teacher', 'ai_service')
  @Get('by-code')
  @ApiOperation({ summary: 'Tra sinh viên theo mã sinh viên' })
  @ApiQuery({ name: 'studentCode', required: true, type: String })
  @ApiOkResponse({ type: StudentResponse })
  @ApiBadRequestResponse({ description: 'Mã sinh viên không hợp lệ.' })
  @ApiNotFoundResponse({ description: 'Sinh viên không tồn tại.' })
  findByCode(@Query('studentCode') studentCode: unknown) {
    return this.students.findByCode(
      knownIdentity(studentCode, 'studentCode', 50),
    );
  }
  @Get()
  @ApiOperation({ summary: 'Danh sách sinh viên' })
  @ApiOkResponse({ type: [StudentResponse] })
  async findAll(@Req() request: AuthRequest) {
    if (request.user.role === 'student') return request.user.studentId ? [await this.students.require(request.user.studentId)] : [];
    return this.students.findAll();
  }
}

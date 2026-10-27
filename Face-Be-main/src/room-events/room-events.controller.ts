import { Req, ForbiddenException } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.guard';
import { Roles } from '../auth/roles';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { parseEvent, parseFilters } from './room-events.dto';
import { RoomEventsService } from './room-events.service';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateRoomEventBody,
  EventPageResponse,
  EventResultResponse,
} from '../docs/api-models';

@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Bearer token thiếu, không hợp lệ hoặc hết hạn.',
})
@Controller('room-events')
@ApiTags('room-events')
export class RoomEventsController {
  constructor(private readonly events: RoomEventsService) {}
  @Roles('admin', 'teacher', 'ai_service')
  @Post()
  @ApiOperation({
    summary: 'Lưu sự kiện vào/ra',
    description:
      'Gửi lại cùng key và nội dung trả bản ghi cũ (200). Dùng key cũ với nội dung khác trả 409.',
  })
  @ApiBody({ type: CreateRoomEventBody })
  @ApiCreatedResponse({
    type: EventResultResponse,
    description: 'Sự kiện mới, duplicate=false.',
  })
  @ApiOkResponse({
    type: EventResultResponse,
    description: 'Sự kiện đã tồn tại, duplicate=true.',
  })
  @ApiBadRequestResponse({ description: 'Dữ liệu sai hoặc unknown.' })
  @ApiNotFoundResponse({ description: 'Sinh viên hoặc phòng không tồn tại.' })
  @ApiConflictResponse({ description: 'eventKey đã thuộc sự kiện khác.' })
  async create(
    @Body() body: unknown,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const data = parseEvent(body);
    if (request.user.role === 'ai_service' && data.source !== 'camera') throw new ForbiddenException('AI accounts can only create camera events');
    const result = await this.events.create(data);
    response.status(result.duplicate ? 200 : 201);
    return result;
  }
  @Get()
  @ApiOperation({
    summary: 'Tra cứu lịch sử',
    description:
      'Bộ lọc kết hợp AND. Khoảng thời gian gồm hai mốc biên. Sắp xếp thời gian và ID giảm dần.',
  })
  @ApiQuery({
    name: 'studentId',
    required: false,
    schema: { type: 'integer', minimum: 1 },
  })
  @ApiQuery({
    name: 'roomId',
    required: false,
    schema: { type: 'integer', minimum: 1 },
  })
  @ApiQuery({ name: 'direction', required: false, enum: ['in', 'out'] })
  @ApiQuery({
    name: 'from',
    required: false,
    schema: { type: 'string', format: 'date-time' },
    description: 'ISO 8601 có múi giờ; phải <= to.',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    schema: { type: 'string', format: 'date-time' },
  })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  })
  @ApiOkResponse({ type: EventPageResponse })
  @ApiBadRequestResponse({
    description: 'Bộ lọc hoặc phân trang không hợp lệ.',
  })
  findAll(@Query() query: unknown, @Req() request: AuthRequest) {
    const filters = parseFilters(query);
    if (request.user.role === 'ai_service') throw new ForbiddenException('AI accounts cannot read history');
    if (request.user.role === 'student') {
      if (!request.user.studentId) return { items: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 };
      if (filters.studentId && filters.studentId !== request.user.studentId) throw new ForbiddenException('Students can only read their own history');
      filters.studentId = request.user.studentId;
    }
    return this.events.findAll(filters);
  }
}

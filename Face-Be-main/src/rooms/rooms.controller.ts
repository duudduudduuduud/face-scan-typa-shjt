import { Roles } from '../auth/roles';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Body, Controller, Get, Post, Patch, Param } from '@nestjs/common';
import { positiveInteger } from '../common/validation';
import { parseRoom } from './rooms.dto';
import { RoomsService } from './rooms.service';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateRoomBody, RoomResponse } from '../docs/api-models';

@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Bearer token thiếu, không hợp lệ hoặc hết hạn.',
})
@Controller('rooms')
@ApiTags('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}
  @Roles('admin', 'teacher')
  @Post()
  @ApiOperation({ summary: 'Tạo phòng' })
  @ApiBody({ type: CreateRoomBody })
  @ApiCreatedResponse({ type: RoomResponse })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ.' })
  @ApiConflictResponse({ description: 'Mã phòng đã tồn tại.' })
  create(@Body() body: unknown) {
    return this.rooms.create(parseRoom(body));
  }
  @Roles('admin', 'teacher')
  @Patch(':id')
  @ApiOperation({ summary: 'Update room' })
  @ApiBody({ type: CreateRoomBody })
  @ApiOkResponse({ type: RoomResponse })
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.rooms.update(positiveInteger(id, 'id', true), parseRoom(body));
  }
  @Get()
  @ApiOperation({ summary: 'Danh sách phòng' })
  @ApiOkResponse({ type: [RoomResponse] })
  findAll() {
    return this.rooms.findAll();
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStudentBody {
  @ApiProperty({
    example: 'SV001',
    minLength: 1,
    maxLength: 50,
    description: 'Mã sinh viên duy nhất; không dùng unknown.',
  })
  studentCode: string;
  @ApiProperty({ example: 'Nguyễn Văn A', minLength: 1, maxLength: 200 })
  fullName: string;
}

export class StudentResponse extends CreateStudentBody {
  @ApiProperty({ example: 1, minimum: 1 })
  id: number;
}

export class CreateRoomBody {
  @ApiProperty({
    example: 'LAB01',
    minLength: 1,
    maxLength: 50,
    description: 'Mã phòng duy nhất.',
  })
  roomCode: string;
  @ApiProperty({ example: 'Phòng thí nghiệm 1', minLength: 1, maxLength: 200 })
  name: string;
}

export class RoomResponse extends CreateRoomBody {
  @ApiProperty({ example: 1, minimum: 1 })
  id: number;
}

export class CreateRoomEventBody {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description: 'ID từ GET /students, không phải mã sinh viên.',
  })
  studentId: number;
  @ApiProperty({ example: 1, minimum: 1, description: 'ID từ GET /rooms.' })
  roomId: number;
  @ApiProperty({ enum: ['in', 'out'], example: 'in' })
  direction: 'in' | 'out';
  @ApiPropertyOptional({
    format: 'date-time',
    example: '2026-10-08T08:30:00+07:00',
    description:
      'ISO 8601 có múi giờ, tối đa 3 chữ số phần giây. Xóa trường này để dùng thời gian hiện tại. Lưu theo UTC.',
  })
  occurredAt?: string;
  @ApiProperty({ enum: ['camera', 'manual'], example: 'camera' })
  source: 'camera' | 'manual';
  @ApiProperty({
    example: 'camera-lab01-event-001',
    minLength: 1,
    maxLength: 200,
    description:
      'Key mới cho mỗi sự kiện. Giữ nguyên key và nội dung khi retry.',
  })
  eventKey: string;
}

export class RoomEventResponse extends CreateRoomEventBody {
  @ApiProperty({ example: 1, minimum: 1 })
  id: number;
  @ApiProperty({ format: 'date-time', example: '2026-10-08T01:30:00.000Z' })
  declare occurredAt: string;
}

export class EventResultResponse {
  @ApiProperty({ type: RoomEventResponse })
  event: RoomEventResponse;
  @ApiProperty({ example: false, description: 'true nếu sự kiện đã tồn tại.' })
  duplicate: boolean;
}

export class EventPageResponse {
  @ApiProperty({ type: [RoomEventResponse] })
  items: RoomEventResponse[];
  @ApiProperty({ example: 1 })
  total: number;
  @ApiProperty({ example: 1 })
  page: number;
  @ApiProperty({ example: 20 })
  limit: number;
  @ApiProperty({ example: 1 })
  totalPages: number;
}

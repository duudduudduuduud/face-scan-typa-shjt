import { BadRequestException } from '@nestjs/common';
import {
  choice,
  object,
  positiveInteger,
  text,
  utcDate,
} from '../common/validation';

export interface CreateRoomEventDto {
  studentId: number;
  roomId: number;
  direction: 'in' | 'out';
  occurredAt?: string;
  source: 'camera' | 'manual';
  eventKey: string;
}
export interface RoomEvent extends CreateRoomEventDto {
  id: number;
  occurredAt: string;
}
export interface EventFilters {
  studentId?: number;
  roomId?: number;
  direction?: 'in' | 'out';
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export function parseEvent(body: unknown): CreateRoomEventDto {
  const data = object(body, [
    'studentId',
    'roomId',
    'direction',
    'occurredAt',
    'source',
    'eventKey',
  ]);
  return {
    studentId: positiveInteger(data.studentId, 'studentId'),
    roomId: positiveInteger(data.roomId, 'roomId'),
    direction: choice(data.direction, 'direction', ['in', 'out']),
    occurredAt:
      data.occurredAt === undefined
        ? undefined
        : utcDate(data.occurredAt, 'occurredAt'),
    source: choice(data.source, 'source', ['camera', 'manual']),
    eventKey: text(data.eventKey, 'eventKey'),
  };
}

export function parseFilters(query: unknown): EventFilters {
  const data = object(query, [
    'studentId',
    'roomId',
    'direction',
    'from',
    'to',
    'page',
    'limit',
  ]);
  const filters: EventFilters = {
    studentId:
      data.studentId === undefined
        ? undefined
        : positiveInteger(data.studentId, 'studentId', true),
    roomId:
      data.roomId === undefined
        ? undefined
        : positiveInteger(data.roomId, 'roomId', true),
    direction:
      data.direction === undefined
        ? undefined
        : choice(data.direction, 'direction', ['in', 'out']),
    from: data.from === undefined ? undefined : utcDate(data.from, 'from'),
    to: data.to === undefined ? undefined : utcDate(data.to, 'to'),
    page:
      data.page === undefined ? 1 : positiveInteger(data.page, 'page', true),
    limit:
      data.limit === undefined
        ? 20
        : positiveInteger(data.limit, 'limit', true),
  };
  if (filters.limit > 100)
    throw new BadRequestException('limit must not exceed 100');
  if (!Number.isSafeInteger((filters.page - 1) * filters.limit))
    throw new BadRequestException('page is too large');
  if (filters.from && filters.to && filters.from > filters.to)
    throw new BadRequestException('from must not be after to');
  return filters;
}

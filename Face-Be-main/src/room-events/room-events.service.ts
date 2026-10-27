import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService, isDuplicate } from '../database/database.service';
import { StudentsService } from '../students/students.service';
import { RoomsService } from '../rooms/rooms.service';
import type {
  CreateRoomEventDto,
  EventFilters,
  RoomEvent,
} from './room-events.dto';

@Injectable()
export class RoomEventsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly students: StudentsService,
    private readonly rooms: RoomsService,
  ) {}
  async create(
    data: CreateRoomEventDto,
  ): Promise<{ event: RoomEvent; duplicate: boolean }> {
    await this.students.require(data.studentId);
    await this.rooms.require(data.roomId);
    let id: number;
    try {
      id = await this.database.insert(
        'INSERT INTO room_events (studentId, roomId, direction, occurredAt, source, eventKey) VALUES (?, ?, ?, ?, ?, ?)',
        [
          data.studentId,
          data.roomId,
          data.direction,
          data.occurredAt ?? new Date().toISOString(),
          data.source,
          data.eventKey,
        ],
      );
    } catch (error) {
      if (!isDuplicate(error)) throw error;
      const [existing] = await this.database.all<RoomEvent>(
        'SELECT * FROM room_events WHERE eventKey = ?',
        [data.eventKey],
      );
      if (
        !existing ||
        existing.studentId !== data.studentId ||
        existing.roomId !== data.roomId ||
        existing.direction !== data.direction ||
        existing.source !== data.source ||
        (data.occurredAt !== undefined &&
          existing.occurredAt !== data.occurredAt)
      ) {
        throw new ConflictException(
          'eventKey already belongs to a different event',
        );
      }
      return { event: existing, duplicate: true };
    }
    const [saved] = await this.database.all<RoomEvent>(
      'SELECT * FROM room_events WHERE id = ?',
      [id],
    );
    return { event: saved, duplicate: false };
  }
  async findAll(filters: EventFilters) {
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    for (const field of ['studentId', 'roomId', 'direction'] as const) {
      if (filters[field] !== undefined) {
        conditions.push(`${field} = ?`);
        values.push(filters[field]);
      }
    }
    if (filters.from) {
      conditions.push('occurredAt >= ?');
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push('occurredAt <= ?');
      values.push(filters.to);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [count, rows] = await this.database.snapshot([
      { sql: `SELECT COUNT(*) AS total FROM room_events ${where}`, values },
      {
        sql: `SELECT * FROM room_events ${where} ORDER BY occurredAt DESC, id DESC LIMIT ? OFFSET ?`,
        values: [...values, filters.limit, (filters.page - 1) * filters.limit],
      },
    ]);
    const total = Number((count[0] as { total: number }).total);
    return {
      items: rows as RoomEvent[],
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }
}

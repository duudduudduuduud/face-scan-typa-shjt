import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService, isDuplicate } from '../database/database.service';
import type { CreateRoomDto, Room } from './rooms.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly database: DatabaseService) {}
  async create(data: CreateRoomDto): Promise<Room> {
    try {
      const id = await this.database.insert(
        'INSERT INTO rooms (roomCode, name) VALUES (?, ?)',
        [data.roomCode, data.name],
      );
      return await this.require(id);
    } catch (error) {
      if (isDuplicate(error))
        throw new ConflictException('roomCode already exists');
      throw error;
    }
  }
  findAll(): Promise<Room[]> {
    return this.database.all<Room>(
      'SELECT id, roomCode, name FROM rooms ORDER BY id',
    );
  }
  async update(id: number, data: CreateRoomDto): Promise<Room> {
    await this.require(id);
    try {
      await this.database.execute(
        'UPDATE rooms SET roomCode = ?, name = ? WHERE id = ?',
        [data.roomCode, data.name, id],
      );
      return this.require(id);
    } catch (error) {
      if (isDuplicate(error))
        throw new ConflictException('roomCode already exists');
      throw error;
    }
  }
  async require(id: number): Promise<Room> {
    const [row] = await this.database.all<Room>(
      'SELECT * FROM rooms WHERE id = ?',
      [id],
    );
    if (!row) throw new NotFoundException('Room does not exist');
    return row;
  }
}

import { object, text } from '../common/validation';

export interface CreateRoomDto {
  roomCode: string;
  name: string;
}
export interface Room extends CreateRoomDto {
  id: number;
}

export function parseRoom(body: unknown): CreateRoomDto {
  const data = object(body, ['roomCode', 'name']);
  return {
    roomCode: text(data.roomCode, 'roomCode', 50),
    name: text(data.name, 'name'),
  };
}

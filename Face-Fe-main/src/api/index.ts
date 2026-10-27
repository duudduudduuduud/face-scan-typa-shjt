import { post, request } from './client';
import type { EventFilters, EventResult, LoginResponse, ManualPayload, Page, Room, RoomEvent, Student, User } from '../types';

export const register = (body: { username: string; password: string; fullName: string }) => post<User>('/auth/register', body, false);
export const login = (username: string, password: string) => post<LoginResponse>('/auth/login', { username, password }, false);
export const getMe = () => request<User>('/auth/me');
export const getStudents = () => request<Student[]>('/students');
export const createStudent = (body: Pick<Student, 'studentCode' | 'fullName'>) => post<unknown>('/students', body);
export const findStudent = (code: string) => request<Student>(`/students/by-code?studentCode=${encodeURIComponent(code)}`);
export const getRooms = () => request<Room[]>('/rooms');
export const createRoom = (body: Pick<Room, 'roomCode' | 'name'>) => post<unknown>('/rooms', body);
const patch = (path: string, body: unknown) => request<unknown>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const updateStudent = (id: number, body: Pick<Student, 'studentCode' | 'fullName'>) => patch(`/students/${id}`, body);
export const updateRoom = (id: number, body: Pick<Room, 'roomCode' | 'name'>) => patch(`/rooms/${id}`, body);
export function eventQuery(filters: EventFilters) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  return query.toString();
}
export const getEvents = (filters: EventFilters) => request<Page<RoomEvent>>(`/room-events?${eventQuery(filters)}`);
export const createEvent = (body: ManualPayload) => post<EventResult>('/room-events', body);

export type Role = 'admin' | 'teacher' | 'student' | 'ai_service';
export interface Student { id: number; studentCode: string; fullName: string }
export interface Room { id: number; roomCode: string; name: string }
export interface User { role: Role; id: number; username: string; fullName: string; studentId?: number | null }
export interface LoginResponse { accessToken: string; tokenType: string; expiresIn: number; user: User }
export interface Page<T> { items: T[]; total: number; page: number; limit: number; totalPages: number }
export type Direction = 'in' | 'out';
export interface RoomEvent { id: number; studentId: number; roomId: number; direction: Direction; occurredAt: string; source: string; eventKey: string }
export interface ManualPayload { studentId: number; roomId: number; direction: Direction; occurredAt?: string; source: 'manual'; eventKey: string }
export interface EventResult { event: RoomEvent; duplicate: boolean }
export interface EventFilters { studentId?: number; roomId?: number; direction?: Direction; from?: string; to?: string; page: number; limit: number }

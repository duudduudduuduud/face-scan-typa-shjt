import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthRequest } from '../auth/auth.guard';
import { DatabaseService, isDuplicate } from '../database/database.service';
import { object, positiveInteger } from '../common/validation';
import { verifyRecognitionTicket } from '../camera/recognition-ticket';

interface Lesson { id: number; subjectCode: string; subjectName: string; teacherName: string; roomId: number; startsAt: string; endsAt: string; roomCode: string; roomName: string; attendedAt: string | null }
interface StudentLink { studentId: number; studentCode: string; fullName: string }
@Injectable()
export class ScheduleService {
  constructor(private readonly db: DatabaseService) {}
  async student(userId: number): Promise<StudentLink | null> {
    const [row] = await this.db.all<StudentLink>('SELECT a.studentId, s.studentCode, s.fullName FROM student_accounts a JOIN students s ON s.id=a.studentId WHERE a.userId=?', [userId]);
    return row ?? null;
  }
  async month(userId: number, month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 2000) throw new BadRequestException('month must be YYYY-MM');
    const student = await this.student(userId);
    if (!student) return { student: null, items: [] };
    const year = Number(month.slice(0, 4)), m = Number(month.slice(5));
    const next = `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
    const from = new Date(`${month}-01T00:00:00+07:00`).toISOString();
    const to = new Date(`${next}-01T00:00:00+07:00`).toISOString();
    const items = await this.db.all<Lesson>(
      'SELECT l.*, r.roomCode, r.name AS roomName, a.occurredAt AS attendedAt FROM learning_sessions l JOIN session_students e ON e.sessionId=l.id JOIN rooms r ON r.id=l.roomId LEFT JOIN lesson_attendance a ON a.sessionId=l.id AND a.studentId=e.studentId WHERE e.studentId=? AND l.startsAt>=? AND l.startsAt<? ORDER BY l.startsAt, l.id',
      [student.studentId, from, to]);
    const now = Date.now();
    return { student, items: items.map(item => ({ ...item, status: item.attendedAt ? 'present' : Date.parse(item.endsAt) < now ? 'absent' : 'pending', canAttend: !item.attendedAt && now >= Date.parse(item.startsAt) - 15 * 60000 && now <= Date.parse(item.endsAt) })) };
  }
  async attend(userId: number, sessionId: number, ticketValue: unknown) {
    const student = await this.student(userId);
    if (!student) throw new ForbiddenException('Account is not linked to a student');
    const [session] = await this.db.all<Lesson>('SELECT l.* FROM learning_sessions l JOIN session_students e ON e.sessionId=l.id WHERE l.id=? AND e.studentId=?', [sessionId, student.studentId]);
    if (!session) throw new NotFoundException('Session is not in your schedule');
    const [existing] = await this.db.all('SELECT * FROM lesson_attendance WHERE sessionId=? AND studentId=?', [sessionId, student.studentId]);
    // Authorized retry succeeds even after the time window/ticket has expired.
    if (existing) return { attendance: existing, duplicate: true };
    const ticket = verifyRecognitionTicket(ticketValue, userId);
    if (ticket.studentId !== student.studentId) throw new ForbiddenException('Recognized face does not match your student account');
    const now = Date.now();
    if (now < Date.parse(session.startsAt) - 15 * 60000 || now > Date.parse(session.endsAt)) throw new BadRequestException('Attendance is outside the session time window');
    const occurredAt = new Date(now).toISOString();
    try {
      await this.db.insert('INSERT INTO lesson_attendance (sessionId, studentId, occurredAt, source) VALUES (?, ?, ?, ?)', [sessionId, student.studentId, occurredAt, 'camera']);
    } catch (error) {
      if (!isDuplicate(error)) throw error;
      const [attendance] = await this.db.all('SELECT * FROM lesson_attendance WHERE sessionId=? AND studentId=?', [sessionId, student.studentId]);
      return { attendance, duplicate: true };
    }
    const [attendance] = await this.db.all('SELECT * FROM lesson_attendance WHERE sessionId=? AND studentId=?', [sessionId, student.studentId]);
    return { attendance, duplicate: false };
  }
}
@ApiTags('schedule')
@ApiBearerAuth()
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly schedules: ScheduleService) {}
  @Get()
  @ApiQuery({ name: 'month', example: '2026-10', required: true })
  @ApiOperation({ summary: 'Lịch học của tài khoản đăng nhập theo tháng (giờ Việt Nam)' })
  find(@Query('month') month: string, @Req() request: AuthRequest) { return this.schedules.month(request.user.id, month); }
  @Post(':id/attendance')
  @ApiOperation({ summary: 'Điểm danh bằng vé nhận diện; mỗi sinh viên chỉ một lần mỗi buổi' })
  @ApiBody({ schema: { type: 'object', properties: { ticket: { type: 'string' } }, required: ['ticket'] } })
  async attend(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    const data = object(body, ['ticket']);
    const result = await this.schedules.attend(request.user.id, positiveInteger(id, 'id', true), data.ticket);
    response.status(result.duplicate ? 200 : 201);
    return result;
  }
}
@Module({ controllers: [ScheduleController], providers: [ScheduleService] })
export class ScheduleModule {}

import { Roles } from '../auth/roles';
import { BadRequestException, Body, Controller, Module, Post, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import type { AuthRequest } from '../auth/auth.guard';
import { object, positiveInteger } from '../common/validation';
import { StudentsModule } from '../students/students.module';
import { StudentsService } from '../students/students.service';
import { RoomsModule } from '../rooms/rooms.module';
import { RoomEventsModule } from '../room-events/room-events.module';
import { RoomEventsService } from '../room-events/room-events.service';
import { parseEvent } from '../room-events/room-events.dto';

@ApiTags('camera')
@ApiBearerAuth()
@Controller('camera')
export class CameraController {
  constructor(private readonly students: StudentsService, private readonly events: RoomEventsService) {}
  private secret(): string {
    const secret = process.env.AI_SERVICE_KEY ?? '';
    if (secret.length < 32) throw new ServiceUnavailableException('Configure AI_SERVICE_KEY in BE and AI');
    return secret;
  }
  private image(value: unknown): string {
    if (typeof value !== 'string' || !value.startsWith('data:image/jpeg;base64,') || value.length > 2_000_000)
      throw new BadRequestException('JPEG image required, maximum 2 MB');
    return value;
  }
  private async ai(path: string, body: unknown): Promise<Record<string, unknown>> {
    const key = this.secret();
    let response: globalThis.Response;
    try {
      response = await fetch(`${(process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8001').replace(/\/$/, '')}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AI-Key': key },
        body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
      });
    } catch { throw new ServiceUnavailableException('AI service is unavailable'); }
    const result = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      if (response.status === 400) throw new BadRequestException(typeof result?.message === 'string' ? result.message : 'Invalid face photo');
      throw new ServiceUnavailableException('AI service failed');
    }
    if (!result) throw new ServiceUnavailableException('Invalid AI response');
    return result;
  }
  @Roles('admin', 'teacher')
  @Post('enroll')
  @ApiOperation({ summary: 'Register five face photos for an existing student' })
  async enroll(@Body() body: unknown) {
    const data = object(body, ['studentId', 'images']);
    const student = await this.students.require(positiveInteger(data.studentId, 'studentId'));
    if (!Array.isArray(data.images) || data.images.length !== 5) throw new BadRequestException('Five photos required');
    return this.ai('/enroll', { studentCode: student.studentCode, images: data.images.map(value => this.image(value)) });
  }
  @Post('recognize')
  @ApiOperation({ summary: 'Recognize one face without recording an event' })
  async recognize(@Body() body: unknown, @Req() request: AuthRequest) {
    const data = object(body, ['image']);
    const result = await this.ai('/recognize', { image: this.image(data.image) });
    if (result.studentCode === 'unknown') return { student: null, similarity: result.similarity, ticket: null };
    if (typeof result.studentCode !== 'string' || typeof result.similarity !== 'number') throw new ServiceUnavailableException('Invalid recognition response');
    const student = await this.students.findByCode(result.studentCode);
    const encoded = Buffer.from(JSON.stringify({ studentId: student.id, userId: request.user.id, expires: Date.now() + 15 * 60 * 1000 })).toString('base64url');
    const signature = createHmac('sha256', this.secret()).update(encoded).digest('base64url');
    return { student, similarity: result.similarity, ticket: `${encoded}.${signature}` };
  }
  @Roles('admin', 'teacher', 'ai_service')
  @Post('events')
  @ApiOperation({ summary: 'Confirm a recognized face as a camera event' })
  async record(@Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    const data = object(body, ['ticket', 'roomId', 'direction', 'eventKey', 'occurredAt']);
    if (typeof data.ticket !== 'string' || data.ticket.length > 2000) throw new BadRequestException('Recognition ticket required');
    const [encoded, signature, extra] = data.ticket.split('.');
    const expected = createHmac('sha256', this.secret()).update(encoded ?? '').digest('base64url');
    if (!signature || extra || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new BadRequestException('Invalid recognition ticket');
    let ticket: { studentId: number; userId: number; expires: number };
    try { ticket = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as typeof ticket; }
    catch { throw new BadRequestException('Invalid recognition ticket'); }
    if (ticket.userId !== request.user.id || !Number.isFinite(ticket.expires) || ticket.expires < Date.now()) throw new BadRequestException('Recognition expired; recognize again');
    const result = await this.events.create(parseEvent({ studentId: ticket.studentId, roomId: data.roomId, direction: data.direction, eventKey: data.eventKey, occurredAt: data.occurredAt, source: 'camera' }));
    response.status(result.duplicate ? 200 : 201);
    return result;
  }
}

@Module({ imports: [StudentsModule, RoomsModule, RoomEventsModule], controllers: [CameraController] })
export class CameraModule {}

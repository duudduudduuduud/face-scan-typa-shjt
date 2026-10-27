import { BadRequestException } from '@nestjs/common';
import { CameraController } from './camera.module';
import type { StudentsService } from '../students/students.service';
import type { RoomEventsService } from '../room-events/room-events.service';
import type { AuthRequest } from '../auth/auth.guard';
import type { Response } from 'express';

describe('Web camera identity and retries', () => {
  const oldKey = process.env.AI_SERVICE_KEY;
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; if (oldKey === undefined) delete process.env.AI_SERVICE_KEY; else process.env.AI_SERVICE_KEY = oldKey; });
  it('binds signed recognition to user and preserves retry event payload', async () => {
    process.env.AI_SERVICE_KEY = 'test-key-not-used-in-production-123456';
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ studentCode: 'SV001', similarity: 0.9 }) });
    const student = { id: 1, studentCode: 'SV001', fullName: 'Test' };
    const students = { findByCode: jest.fn().mockResolvedValue(student) } as unknown as StudentsService;
    const create = jest.fn().mockResolvedValue({ event: { id: 1 }, duplicate: false });
    const controller = new CameraController(students, { create } as unknown as RoomEventsService);
    const request = { user: { id: 7 } } as AuthRequest;
    const preview = await controller.recognize({ image: 'data:image/jpeg;base64,AAAA' }, request);
    expect(create).not.toHaveBeenCalled();
    const body = { ticket: preview.ticket, roomId: 1, direction: 'in', eventKey: 'web-fixed-key', occurredAt: '2026-10-12T08:00:00+07:00' };
    const response = { status: jest.fn() } as unknown as Response;
    await controller.record(body, request, response);
    await controller.record(body, request, response);
    expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
    expect(create.mock.calls[0][0]).toMatchObject({ studentId: 1, source: 'camera', occurredAt: '2026-10-12T01:00:00.000Z' });
    await expect(controller.record(body, { user: { id: 8 } } as AuthRequest, response)).rejects.toThrow(BadRequestException);
    await expect(controller.record({ ...body, ticket: `${preview.ticket}x` }, request, response)).rejects.toThrow(BadRequestException);
  });
});

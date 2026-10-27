import { DatabaseService } from '../src/database/database.service';
import type { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import {
  initializeTestApp,
  bootstrapTestAdmin,
  tokenFor,
  TEST_PASSWORD,
} from './auth-fixture';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Attendance API (SQLite integration)', () => {
  let app: INestApplication;
  let directory: string;
  let previousPath: string | undefined;
  let previousType: string | undefined;
  let studentId: number;
  let roomId: number;
  let adminToken: string;
  let aiToken: string;
  const previousSecret = process.env.JWT_SECRET;
  function request(server: Parameters<typeof supertest>[0]) {
    const agent = supertest(server);
    return {
      get: (url: string) => agent.get(url).set('Authorization', adminToken),
      post: (url: string) =>
        agent
          .post(url)
          .set('Authorization', url === '/room-events' ? aiToken : adminToken),
      options: (url: string) => agent.options(url),
    };
  }
  async function openApp() {
    app = await initializeTestApp();
  }
  beforeEach(async () => {
    previousPath = process.env.DATABASE_PATH;
    previousType = process.env.DB_TYPE;
    process.env.DB_TYPE = 'sqlite';
    directory = mkdtempSync(join(tmpdir(), 'attendance-test-'));
    process.env.DATABASE_PATH = join(directory, 'test.sqlite');
    await openApp();
    await bootstrapTestAdmin(app);
    adminToken = await tokenFor(app, 'test_admin');
    studentId = (
      await request(app.getHttpServer())
        .post('/students')
        .send({ studentCode: 'SV001', fullName: 'Nguyễn Văn A' })
        .expect(201)
    ).body.id;
    roomId = (
      await request(app.getHttpServer())
        .post('/rooms')
        .send({ roomCode: 'LAB01', name: 'Phòng thí nghiệm' })
        .expect(201)
    ).body.id;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'test_ai',
        password: TEST_PASSWORD,
        fullName: 'Test AI',
      })
      .expect(201);
    await app.get(DatabaseService).execute("UPDATE users SET role='ai_service' WHERE username='test_ai'");
    aiToken = await tokenFor(app, 'test_ai');
  });
  afterEach(async () => {
    if (app) await app.close();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    if (previousType === undefined) delete process.env.DB_TYPE;
    else process.env.DB_TYPE = previousType;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    rmSync(directory, { recursive: true, force: true });
  });
  function event(overrides: Record<string, unknown> = {}) {
    return {
      studentId,
      roomId,
      direction: 'in',
      source: 'camera',
      eventKey: 'camera-1',
      ...overrides,
    };
  }
  it('stores current UTC time and persists all data across restart', async () => {
    const before = Date.now();
    const result = await request(app.getHttpServer())
      .post('/room-events')
      .send(event())
      .expect(201);
    expect(result.body).toMatchObject({ duplicate: false, event: event() });
    expect(result.body.event.occurredAt).toMatch(/Z$/);
    expect(Date.parse(result.body.event.occurredAt)).toBeGreaterThanOrEqual(
      before,
    );
    expect(Date.parse(result.body.event.occurredAt)).toBeLessThanOrEqual(
      Date.now(),
    );
    await app.close();
    await openApp();
    expect(
      (await request(app.getHttpServer()).get('/room-events').expect(200)).body
        .items,
    ).toEqual([result.body.event]);
    expect(
      (await request(app.getHttpServer()).get('/students').expect(200)).body,
    ).toHaveLength(1);
    expect(
      (await request(app.getHttpServer()).get('/rooms').expect(200)).body,
    ).toHaveLength(1);
    expect(
      (
        await request(app.getHttpServer())
          .post('/room-events')
          .send(event())
          .expect(200)
      ).body,
    ).toEqual({ event: result.body.event, duplicate: true });
  });
  it('normalizes timezone offsets to UTC and deduplicates equivalent times', async () => {
    const result = await request(app.getHttpServer())
      .post('/room-events')
      .send(event({ occurredAt: '2026-10-08T08:30:00+07:00' }))
      .expect(201);
    expect(result.body.event.occurredAt).toBe('2026-10-08T01:30:00.000Z');
    await request(app.getHttpServer())
      .post('/room-events')
      .send(event({ occurredAt: '2026-10-08T01:30:00Z' }))
      .expect(200);
  });
  it('deduplicates concurrent retries using a unique eventKey', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app.getHttpServer()).post('/room-events').send(event()),
      ),
    );
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 200)).toHaveLength(7);
    expect(new Set(results.map((result) => result.body.event.id)).size).toBe(1);
    expect(
      (await request(app.getHttpServer()).get('/room-events')).body.total,
    ).toBe(1);
  });
  it.each([
    { direction: 'out' },
    { source: 'manual' },
    { occurredAt: '2026-10-08T00:00:00Z' },
  ])('rejects eventKey reuse with changed payload %j', async (overrides) => {
    await request(app.getHttpServer())
      .post('/room-events')
      .send(event())
      .expect(201);
    await request(app.getHttpServer())
      .post('/room-events')
      .set('Authorization', 'source' in overrides ? adminToken : aiToken)
      .send(event(overrides))
      .expect(409);
    expect(
      (await request(app.getHttpServer()).get('/room-events')).body.total,
    ).toBe(1);
  });
  it('combines all filters, includes time boundaries and paginates', async () => {
    const otherStudent = (
      await request(app.getHttpServer())
        .post('/students')
        .send({ studentCode: 'SV002', fullName: 'Trần Văn B' })
    ).body.id;
    const otherRoom = (
      await request(app.getHttpServer())
        .post('/rooms')
        .send({ roomCode: 'LAB02', name: 'Lab 2' })
    ).body.id;
    const records = [
      { eventKey: 'start', occurredAt: '2026-10-08T01:00:00Z' },
      { eventKey: 'end', occurredAt: '2026-10-08T02:00:00Z' },
      { eventKey: 'before', occurredAt: '2026-10-08T00:59:59Z' },
      { eventKey: 'after', occurredAt: '2026-10-08T02:00:01Z' },
      { eventKey: 'out', direction: 'out', occurredAt: '2026-10-08T01:30:00Z' },
      {
        eventKey: 'other-student',
        studentId: otherStudent,
        occurredAt: '2026-10-08T01:30:00Z',
      },
      {
        eventKey: 'other-room',
        roomId: otherRoom,
        occurredAt: '2026-10-08T01:30:00Z',
      },
    ];
    for (const record of records)
      await request(app.getHttpServer())
        .post('/room-events')
        .send(event(record))
        .expect(201);
    const filters = {
      studentId,
      roomId,
      direction: 'in',
      from: '2026-10-08T08:00:00+07:00',
      to: '2026-10-08T09:00:00+07:00',
      limit: 1,
    };
    const first = (
      await request(app.getHttpServer())
        .get('/room-events')
        .query(filters)
        .expect(200)
    ).body;
    expect(first).toMatchObject({ total: 2, page: 1, limit: 1, totalPages: 2 });
    expect(first.items[0].eventKey).toBe('end');
    const second = (
      await request(app.getHttpServer())
        .get('/room-events')
        .query({ ...filters, page: 2 })
        .expect(200)
    ).body;
    expect(second.items[0].eventKey).toBe('start');
    expect(
      (
        await request(app.getHttpServer())
          .get('/room-events')
          .query({ ...filters, page: 3 })
      ).body.items,
    ).toEqual([]);
  });
  it('orders equal timestamps by descending id', async () => {
    for (const eventKey of ['a', 'b'])
      await request(app.getHttpServer())
        .post('/room-events')
        .send(event({ eventKey, occurredAt: '2026-10-08T00:00:00Z' }))
        .expect(201);
    const result = await request(app.getHttpServer())
      .get('/room-events')
      .expect(200);
    expect(
      result.body.items.map((item: { eventKey: string }) => item.eventKey),
    ).toEqual(['b', 'a']);
  });
  it.each([{ studentId: 999 }, { roomId: 999 }])(
    'rejects nonexistent references %j',
    async (overrides) => {
      await request(app.getHttpServer())
        .post('/room-events')
        .set('Authorization', adminToken)
        .send(event({ ...overrides, source: 'manual' }))
        .expect(404);
      expect(
        (await request(app.getHttpServer()).get('/room-events')).body.total,
      ).toBe(0);
    },
  );
  it.each([
    { studentId: 'unknown' },
    { studentId: '1' },
    { roomId: null },
    { studentId: -1 },
    { direction: 'enter' },
    { source: 'unknown' },
    { eventKey: '' },
    { eventKey: null },
    { occurredAt: null },
    { occurredAt: '2026-02-30T08:00:00Z' },
    { occurredAt: '2026-10-08T08:00:00' },
    { occurredAt: 'invalid' },
    { identity: 'unknown' },
  ])('rejects invalid event input %j without saving', async (overrides) => {
    await request(app.getHttpServer())
      .post('/room-events')
      .send(event(overrides))
      .expect(400);
    expect(
      (await request(app.getHttpServer()).get('/room-events')).body.total,
    ).toBe(0);
  });
  it('requires all event fields except occurredAt', async () => {
    for (const field of [
      'studentId',
      'roomId',
      'direction',
      'source',
      'eventKey',
    ]) {
      const payload: Record<string, unknown> = event();
      delete payload[field];
      await request(app.getHttpServer())
        .post('/room-events')
        .send(payload)
        .expect(400);
    }
  });
  it.each([
    { page: '0' },
    { page: '1.5' },
    { limit: '101' },
    { limit: '-1' },
    { studentId: 'unknown' },
    { roomId: '0' },
    { direction: 'unknown' },
    { from: '2026-02-30T00:00:00Z' },
    { from: '2026-10-09T00:00:00Z', to: '2026-10-08T00:00:00Z' },
    { unexpected: 'field' },
    { studentId: ['1', '2'] },
  ])('rejects invalid history filters %j', async (query) => {
    await request(app.getHttpServer())
      .get('/room-events')
      .query(query)
      .expect(400);
  });
  it('enforces unique codes, required names and rejects unknown students', async () => {
    await request(app.getHttpServer())
      .post('/students')
      .send({ studentCode: 'sv001', fullName: 'Other' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/rooms')
      .send({ roomCode: 'lab01', name: 'Other' })
      .expect(409);
    for (const body of [
      { studentCode: ' UNKNOWN ', fullName: 'Person' },
      { studentCode: 'SV003', fullName: 'Unknown' },
      { studentCode: '', fullName: 'Person' },
      { studentCode: 'SV003' },
    ]) {
      await request(app.getHttpServer())
        .post('/students')
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/rooms')
      .send({ roomCode: 'LAB03', name: '' })
      .expect(400);
  });
  it('allows React CORS preflight requests', async () => {
    const result = await request(app.getHttpServer())
      .options('/room-events')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);
    expect(result.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(result.headers['access-control-allow-methods']).toContain('POST');
  });
});

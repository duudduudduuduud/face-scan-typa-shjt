import { DatabaseService } from '../src/database/database.service';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  initializeTestApp,
  bootstrapTestAdmin,
  tokenFor,
} from './auth-fixture';

describe('AI integration contract', () => {
  let app: INestApplication;
  const previous = {
    type: process.env.DB_TYPE,
    path: process.env.DATABASE_PATH,
    secret: process.env.JWT_SECRET,
  };
  beforeAll(async () => {
    process.env.DB_TYPE = 'sqlite';
    process.env.DATABASE_PATH = ':memory:';
    process.env.JWT_SECRET = 'integration-test-secret-at-least-32-bytes';
    app = await initializeTestApp();
    await bootstrapTestAdmin(app);
  });
  afterAll(async () => {
    if (app) await app.close();
    for (const [key, value] of Object.entries({
      DB_TYPE: previous.type,
      DATABASE_PATH: previous.path,
      JWT_SECRET: previous.secret,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  it('authenticates, resolves codes, and enforces event retry semantics', async () => {
    const server = app.getHttpServer();
    await request(server)
      .get('/students/by-code?studentCode=BIT230396')
      .expect(401);
    const adminAuthorization = await tokenFor(app, 'test_admin');
    await request(server)
      .post('/auth/register')
      .set('Authorization', adminAuthorization)
      .send({
        username: 'ai_test',
        password: 'TestPassword123!',
        fullName: 'AI test',
      })
      .expect(201);
    await app.get(DatabaseService).execute("UPDATE users SET role='ai_service' WHERE username='ai_test'");
    const login = await request(server)
      .post('/auth/login')
      .send({ username: 'ai_test', password: 'TestPassword123!' })
      .expect(200);
    expect(login.body.expiresIn).toBe(3600);
    const authorization = `Bearer ${login.body.accessToken}`;
    const student = await request(server)
      .post('/students')
      .set('Authorization', adminAuthorization)
      .send({ studentCode: 'BIT230396', fullName: 'Test Student' })
      .expect(201);
    const lookup = await request(server)
      .get('/students/by-code?studentCode=BIT230396')
      .set('Authorization', authorization)
      .expect(200);
    expect(lookup.body).toEqual(student.body);
    await request(server)
      .get('/students/by-code?studentCode=MISSING')
      .set('Authorization', authorization)
      .expect(404);
    await request(server)
      .get('/students/by-code')
      .set('Authorization', authorization)
      .expect(400);
    await request(server)
      .get('/students/by-code?studentCode=unknown')
      .set('Authorization', authorization)
      .expect(400);
    const room = await request(server)
      .post('/rooms')
      .set('Authorization', adminAuthorization)
      .send({ roomCode: 'A101', name: 'Room A101' })
      .expect(201);
    const data = {
      studentId: lookup.body.id,
      roomId: room.body.id,
      direction: 'in',
      source: 'camera',
      occurredAt: '2026-10-12T08:00:00+07:00',
      eventKey: 'camera-01-event-unique',
    };
    const created = await request(server)
      .post('/room-events')
      .set('Authorization', authorization)
      .send(data)
      .expect(201);
    expect(created.body).toEqual({
      event: {
        ...data,
        id: expect.any(Number),
        occurredAt: '2026-10-12T01:00:00.000Z',
      },
      duplicate: false,
    });
    const retry = await request(server)
      .post('/room-events')
      .set('Authorization', authorization)
      .send(data)
      .expect(200);
    expect(retry.body).toEqual({ ...created.body, duplicate: true });
    const conflict = await request(server)
      .post('/room-events')
      .set('Authorization', authorization)
      .send({ ...data, direction: 'out' })
      .expect(409);
    expect(conflict.body).toEqual({
      statusCode: 409,
      message: 'eventKey already belongs to a different event',
      error: 'Conflict',
    });
    const bad = await request(server)
      .post('/room-events')
      .set('Authorization', authorization)
      .send({ ...data, studentId: 'BIT230396' })
      .expect(400);
    expect(bad.body).toEqual({
      statusCode: 400,
      message: 'studentId must be a positive integer',
      error: 'Bad Request',
    });
    await request(server)
      .post('/room-events')
      .set('Authorization', authorization)
      .send({ ...data, occurredAt: '2026-10-12T08:00:00' })
      .expect(400);
    const missing = await request(server)
      .post('/room-events')
      .set('Authorization', authorization)
      .send({ ...data, studentId: 999999 })
      .expect(404);
    expect(missing.body).toEqual({
      statusCode: 404,
      message: 'Student does not exist',
      error: 'Not Found',
    });
    const unauthenticated = await request(server)
      .post('/room-events')
      .send(data)
      .expect(401);
    expect(unauthenticated.body).toEqual({
      statusCode: 401,
      message: 'Bearer token is required',
      error: 'Unauthorized',
    });
    const { occurredAt: _time, ...withoutTime } = data;
    const implicit = await request(server)
      .post('/room-events')
      .set('Authorization', authorization)
      .send({ ...withoutTime, eventKey: 'implicit-time' })
      .expect(201);
    const implicitRetry = await request(server)
      .post('/room-events')
      .set('Authorization', authorization)
      .send({ ...withoutTime, eventKey: 'implicit-time' })
      .expect(200);
    expect(implicitRetry.body.event).toEqual(implicit.body.event);
  });
});

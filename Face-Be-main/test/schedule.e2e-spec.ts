import type { INestApplication } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { initializeTestApp, bootstrapTestAdmin, tokenFor } from './auth-fixture';

describe('Student schedule and face attendance', () => {
  let app: INestApplication, db: DatabaseService, authorization: string, studentId: number, userId: number;
  const previous = { DB_TYPE: process.env.DB_TYPE, DATABASE_PATH: process.env.DATABASE_PATH, AI_SERVICE_KEY: process.env.AI_SERVICE_KEY, JWT_SECRET: process.env.JWT_SECRET };
  const secret = 'schedule-test-only-secret-at-least-32-bytes';
  let roomId: number;
  beforeAll(async () => {
    process.env.DB_TYPE = 'sqlite'; process.env.DATABASE_PATH = ':memory:'; process.env.AI_SERVICE_KEY = secret;
    app = await initializeTestApp();
    const user = await bootstrapTestAdmin(app); userId = user.id;
    authorization = await tokenFor(app, 'test_admin'); db = app.get(DatabaseService);
    studentId = await db.insert('INSERT INTO students(studentCode,fullName) VALUES(?,?)', ['SV001','Test Student']);
    roomId = await db.insert('INSERT INTO rooms(roomCode,name) VALUES(?,?)', ['LAB01','Test Lab']);
    await db.execute('INSERT INTO student_accounts(userId,studentId) VALUES(?,?)', [userId,studentId]);
  });
  afterAll(async () => { if (app) await app.close(); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  async function lesson(starts = Date.now()-60000, ends = Date.now()+3600000) {
    const id = await db.insert('INSERT INTO learning_sessions(subjectCode,subjectName,teacherName,roomId,startsAt,endsAt) VALUES(?,?,?,?,?,?)', ['IT101','Test Lesson','Teacher',roomId,new Date(starts).toISOString(),new Date(ends).toISOString()]);
    await db.execute('INSERT INTO session_students(sessionId,studentId) VALUES(?,?)', [id,studentId]);
    return id;
  }
  function ticket(id = studentId, account = userId, expires = Date.now()+60000) {
    const body = Buffer.from(JSON.stringify({ studentId:id, userId:account, expires })).toString('base64url');
    return `${body}.${createHmac('sha256',secret).update(body).digest('base64url')}`;
  }
  it('requires login, exposes linked student, and validates month', async () => {
    await request(app.getHttpServer()).get('/schedule?month=2026-10').expect(401);
    const profile = await request(app.getHttpServer()).get('/auth/me').set('Authorization',authorization).expect(200);
    expect(profile.body.studentId).toBe(studentId);
    await request(app.getHttpServer()).get('/schedule?month=2026-13').set('Authorization',authorization).expect(400);
  });
  it('rejects wrong face, forged or foreign ticket, and sessions outside enrollment', async () => {
    const id = await lesson();
    for (const [value, status] of [[ticket(studentId+1),403],[ticket(studentId,userId+1),400],[`${ticket()}x`,400]] as const) {
      await request(app.getHttpServer()).post(`/schedule/${id}/attendance`).set('Authorization',authorization).send({ticket:value}).expect(status);
    }
    await request(app.getHttpServer()).post('/schedule/99999/attendance').set('Authorization',authorization).send({ticket:ticket()}).expect(404);
    expect(await db.all('SELECT * FROM lesson_attendance')).toHaveLength(0);
  });
  it('rejects attendance outside the configured time window', async () => {
    const id = await lesson(Date.now()+3600000,Date.now()+7200000);
    await request(app.getHttpServer()).post(`/schedule/${id}/attendance`).set('Authorization',authorization).send({ticket:ticket()}).expect(400);
  });
  it('records once under concurrent retries and exposes personal month status', async () => {
    const id = await lesson();
    const responses = await Promise.all([0,1].map(() => request(app.getHttpServer()).post(`/schedule/${id}/attendance`).set('Authorization',authorization).send({ticket:ticket()})));
    expect(responses.map(response => response.status).sort((a,b) => a-b)).toEqual([200,201]);
    expect(await db.all('SELECT * FROM lesson_attendance WHERE sessionId=?', [id])).toHaveLength(1);
    const month = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).format(new Date());
    const result = await request(app.getHttpServer()).get(`/schedule?month=${month}`).set('Authorization',authorization).expect(200);
    expect(result.body.items.find((item: {id:number}) => item.id === id)).toMatchObject({status:'present',canAttend:false});
    await request(app.getHttpServer()).post(`/schedule/${id}/attendance`).set('Authorization',authorization).send({ticket:ticket(studentId,userId,0)}).expect(200);
  });
});

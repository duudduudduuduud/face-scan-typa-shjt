import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { initializeTestApp, TEST_PASSWORD, bootstrapTestAdmin, tokenFor } from './auth-fixture';
import { DatabaseService } from '../src/database/database.service';

describe('Simple public authentication', () => {
  let app: INestApplication;
  const before = { ...process.env };
  beforeEach(async () => {
    process.env.DB_TYPE = 'sqlite';
    process.env.DATABASE_PATH = ':memory:';
    process.env.JWT_SECRET = 'simple-auth-test-secret-at-least-32-bytes';
    app = await initializeTestApp();
  });
  afterEach(async () => {
    if (app) await app.close();
    process.env = { ...before };
  });
  const credentials = {
    username: 'demo_user',
    password: TEST_PASSWORD,
    fullName: 'Demo User',
  };
  it('registers, hashes passwords, logs in and returns only public user fields', async () => {
    const server = app.getHttpServer();
    const registered = await request(server)
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    expect(registered.body).toEqual({
      id: expect.any(Number),
      username: 'demo_user',
      fullName: 'Demo User',
      role: 'teacher',
    });
    const [stored] = await app
      .get(DatabaseService)
      .all<{ passwordHash: string }>(
        'SELECT passwordHash FROM users WHERE id = ?',
        [registered.body.id],
      );
    expect(stored.passwordHash).toMatch(/^scrypt:/);
    expect(stored.passwordHash).not.toBe(TEST_PASSWORD);
    await request(server)
      .post('/auth/register')
      .send({ ...credentials, username: 'DEMO_USER' })
      .expect(409);
    const login = await request(server)
      .post('/auth/login')
      .send({ username: credentials.username, password: TEST_PASSWORD })
      .expect(200);
    expect(login.body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: registered.body,
    });
    const authorization = `Bearer ${login.body.accessToken}`;
    expect(
      (
        await request(server)
          .get('/auth/me')
          .set('Authorization', authorization)
          .expect(200)
      ).body,
    ).toEqual(registered.body);
    await request(server)
      .post('/auth/login')
      .send({ username: 'demo_user', password: 'WrongPassword123!' })
      .expect(401);
    await request(server).get('/students').expect(401);
    await request(server)
      .get('/rooms')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    const expired = await app
      .get(JwtService)
      .signAsync({ sub: String(registered.body.id) }, { expiresIn: -1 });
    await request(server)
      .get('/rooms')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    await request(server)
      .get('/admin/users')
      .set('Authorization', authorization)
      .expect(404);
  });
  it.each([
    { ...credentials, role: 'admin' },
    { ...credentials, studentId: 1 },
    { ...credentials, isActive: true },
    { ...credentials, username: 'x' },
    { ...credentials, password: 'short' },
    { username: 'demo_user', password: TEST_PASSWORD },
  ])('validates registration payload %j', async (body) => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(body)
      .expect(400);
  });
  it('enforces roles from the database on existing tokens and scopes student history', async () => {
    const server = app.getHttpServer();
    const db = app.get(DatabaseService);
    await bootstrapTestAdmin(app);
    const staffToken = await tokenFor(app, 'test_admin');
    const accounts: { id: number; token: string }[] = [];
    for (const username of ['first_user', 'second_user']) {
      const registered = await request(server).post('/auth/register').set('Authorization',staffToken).send({ ...credentials, username }).expect(201);
      await db.execute("UPDATE users SET role='student' WHERE id=?", [registered.body.id]);
      const login = await request(server).post('/auth/login').send({username,password:TEST_PASSWORD}).expect(200);
      expect(login.body.user.role).toBe('student');
      accounts.push({ id: registered.body.id, token: `Bearer ${login.body.accessToken}` });
    }
    for (const account of accounts) {
      await request(server).post('/students').set('Authorization',account.token).send({studentCode:'SV001',fullName:'Student'}).expect(403);
      await request(server).post('/rooms').set('Authorization',account.token).send({roomCode:'A101',name:'Room'}).expect(403);
      await request(server).post('/room-events').set('Authorization',account.token).send({}).expect(403);
    }
    await db.execute("UPDATE users SET role='teacher' WHERE id=?", [accounts[0].id]);
    const student = await request(server).post('/students').set('Authorization',accounts[0].token).send({studentCode:'SV001',fullName:'Student'}).expect(201);
    const other = await request(server).post('/students').set('Authorization',accounts[0].token).send({studentCode:'SV002',fullName:'Other'}).expect(201);
    const room = await request(server).post('/rooms').set('Authorization',accounts[0].token).send({roomCode:'LAB01',name:'Lab'}).expect(201);
    await db.execute('INSERT INTO student_accounts(userId,studentId) VALUES(?,?)', [accounts[1].id,student.body.id]);
    for (const id of [student.body.id,other.body.id]) await request(server).post('/room-events').set('Authorization',accounts[0].token).send({studentId:id,roomId:room.body.id,direction:'in',source:'manual',eventKey:`role-test-${id}`}).expect(201);
    const list = await request(server).get('/students').set('Authorization',accounts[1].token).expect(200);
    expect(list.body).toEqual([student.body]);
    const history = await request(server).get('/room-events').set('Authorization',accounts[1].token).expect(200);
    expect(history.body.total).toBe(1);
    expect(history.body.items[0].studentId).toBe(student.body.id);
    await request(server).get(`/room-events?studentId=${other.body.id}`).set('Authorization',accounts[1].token).expect(403);
    await db.execute("UPDATE users SET role='student' WHERE id=?", [accounts[0].id]);
    await request(server).post('/rooms').set('Authorization',accounts[0].token).send({roomCode:'NEW',name:'New'}).expect(403);
  });
  it('preserves role while accepting unrelated legacy columns', async () => {
    const db = app.get(DatabaseService);
    await db.execute(
      'ALTER TABLE users ADD COLUMN isActive INTEGER NOT NULL DEFAULT 0',
    );
    await db.execute('ALTER TABLE users ADD COLUMN studentId INTEGER');
    const server = app.getHttpServer();
    await request(server).post('/auth/register').send(credentials).expect(201);
    const login = await request(server)
      .post('/auth/login')
      .send({ username: credentials.username, password: TEST_PASSWORD })
      .expect(200);
    expect(login.body.user).toEqual({
      id: expect.any(Number),
      username: credentials.username,
      fullName: credentials.fullName,
      role: 'teacher',
    });
    await request(server)
      .get('/students')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
  });
});

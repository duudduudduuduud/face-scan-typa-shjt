import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { initializeTestApp, TEST_PASSWORD } from './auth-fixture';
describe('Teacher registration and student provisioning', () => {
  let app: INestApplication;
  const previous = { ...process.env };
  beforeEach(async () => { process.env.DB_TYPE='sqlite';process.env.DATABASE_PATH=':memory:';app=await initializeTestApp(); });
  afterEach(async () => { await app.close();process.env={...previous}; });
  it('creates teachers for all concurrent public registrations', async () => {
    const responses = await Promise.all(['teacher_a','teacher_b'].map(username => request(app.getHttpServer()).post('/auth/register').send({username,password:TEST_PASSWORD,fullName:'Teacher Test'})));
    expect(responses.map(response => response.status).sort((a,b) => a-b)).toEqual([201,201]);
    expect(responses.every(response => response.body.role === 'teacher')).toBe(true);
    expect(await app.get(DatabaseService).all('SELECT id FROM users')).toHaveLength(2);
  });
  it('lets a teacher create a linked student account and denies anonymous/student provisioning', async () => {
    const server=app.getHttpServer();
    await request(server).post('/auth/register').send({username:'teacher_test',password:TEST_PASSWORD,fullName:'Teacher'}).expect(201);
    const login=await request(server).post('/auth/login').send({username:'teacher_test',password:TEST_PASSWORD}).expect(200);
    const token=`Bearer ${login.body.accessToken}`;
    const student=await request(server).post('/students').set('Authorization',token).send({studentCode:'SV001',fullName:'Student'}).expect(201);
    const body={username:'student_test',password:TEST_PASSWORD,fullName:'Student',studentId:student.body.id};
    await request(server).post('/auth/student-accounts').send(body).expect(401);
    const account=await request(server).post('/auth/student-accounts').set('Authorization',token).send(body).expect(201);
    expect(account.body).toMatchObject({role:'student',studentId:student.body.id});
    expect(account.body.passwordHash).toBeUndefined();
    await request(server).post('/auth/student-accounts').set('Authorization',token).send({...body,username:'student_again'}).expect(409);
    const studentLogin=await request(server).post('/auth/login').send({username:'student_test',password:TEST_PASSWORD}).expect(200);
    expect(studentLogin.body.user.role).toBe('student');
    await request(server).post('/auth/student-accounts').set('Authorization',`Bearer ${studentLogin.body.accessToken}`).send(body).expect(403);
    await request(server).post('/auth/register').send({username:'new_teacher',password:TEST_PASSWORD,fullName:'Another'}).expect(201);
    expect(await app.get(DatabaseService).all('SELECT id FROM users')).toHaveLength(3);
  });
});

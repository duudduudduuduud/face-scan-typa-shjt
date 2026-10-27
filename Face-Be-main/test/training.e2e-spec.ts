import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { initializeTestApp, TEST_PASSWORD, tokenFor } from './auth-fixture';

describe('AI training authorization and proxy', () => {
  let app: INestApplication;
  const env = { ...process.env };
  beforeEach(async () => { process.env.DB_TYPE='sqlite'; process.env.DATABASE_PATH=':memory:'; process.env.AI_SERVICE_KEY='a'.repeat(32); app=await initializeTestApp(); });
  afterEach(async () => { jest.restoreAllMocks(); await app.close(); process.env={...env}; });
  it('rejects anonymous and student calls without invoking AI', async () => {
    const server=app.getHttpServer();
    const user=await request(server).post('/auth/register').send({username:'student_test',password:TEST_PASSWORD,fullName:'Student'}).expect(201);
    await app.get(DatabaseService).execute("UPDATE users SET role='student' WHERE id=?", [user.body.id]);
    const token=await tokenFor(app,'student_test');
    const fetcher=jest.spyOn(globalThis,'fetch');
    await request(server).get('/ai-training').expect(401);
    await request(server).get('/ai-training').set('Authorization',token).expect(403);
    await request(server).post('/ai-training/jobs').set('Authorization',token).send({}).expect(403);
    await request(server).post('/ai-training/activate').set('Authorization',token).send({version:null}).expect(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('proxies teacher operations and validates activation IDs', async () => {
    const server=app.getHttpServer();
    await request(server).post('/auth/register').send({username:'teacher_test',password:TEST_PASSWORD,fullName:'Teacher'}).expect(201);
    const token=await tokenFor(app,'teacher_test');
    const fetcher=jest.spyOn(globalThis,'fetch').mockImplementation(async () => new Response(JSON.stringify({dataset:[],versions:[],activeId:null,job:null}),{headers:{'Content-Type':'application/json'}}));
    await request(server).get('/ai-training').set('Authorization',token).expect(200);
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({'X-AI-Key':'a'.repeat(32)});
    await request(server).post('/ai-training/jobs').set('Authorization',token).send({}).expect(201);
    await request(server).post('/ai-training/activate').set('Authorization',token).send({version:null}).expect(201);
    await request(server).post('/ai-training/activate').set('Authorization',token).send({version:'../unsafe'}).expect(400);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({message:'Need two students'}),{status:400}));
    await request(server).post('/ai-training/jobs').set('Authorization',token).send({}).expect(400);
  });
});

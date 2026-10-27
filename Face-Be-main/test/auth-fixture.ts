import { DatabaseService } from '../src/database/database.service';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
export const TEST_PASSWORD = 'IntegrationPassword123!';
export async function initializeTestApp(): Promise<INestApplication> {
  process.env.JWT_SECRET ??= 'integration-test-secret-with-at-least-32-bytes';
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = module.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
export async function bootstrapTestAdmin(app: INestApplication) {
  const user = (
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'test_admin',
        password: TEST_PASSWORD,
        fullName: 'Test User',
      })
      .expect(201)
  ).body;
  await app.get(DatabaseService).execute("UPDATE users SET role='admin' WHERE id=?", [user.id]);
  return { ...user, role: 'admin' };
}
export async function tokenFor(
  app: INestApplication,
  username: string,
): Promise<string> {
  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ username, password: TEST_PASSWORD })
    .expect(200);
  return `Bearer ${login.body.accessToken}`;
}

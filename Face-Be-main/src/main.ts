import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

async function bootstrap() {
  if (existsSync('.env')) loadEnvFile('.env');
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '12mb' });
  configureApp(app);
  app.enableShutdownHooks();
  try {
    await app.listen(port);
  } catch (error) {
    await app.close();
    throw error;
  }
  const address = app.getHttpServer().address() as { port: number };
  console.log(`\nSwagger: http://localhost:${address.port}/docs\n`);
}
void bootstrap().catch((error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 'EADDRINUSE') {
    console.error(`Port ${process.env.PORT ?? 3000} is already in use. Stop the previous backend terminal with Ctrl+C, then run npm run start:dev again.`);
  } else {
    console.error(error instanceof Error ? error.message : 'Backend startup failed');
  }
  process.exitCode = 1;
});

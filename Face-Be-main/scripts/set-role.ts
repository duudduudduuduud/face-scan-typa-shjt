import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { ROLE_VALUES } from '../src/auth/roles';
@Module({ imports: [DatabaseModule] })
class RoleSetupModule {}
async function main() {
  if (existsSync('.env')) loadEnvFile('.env');
  const [username, role] = process.argv.slice(2);
  if (!username || !ROLE_VALUES.some(value => value === role)) throw new Error('Usage: npm run auth:set-role -- username admin|teacher|student|ai_service');
  const app = await NestFactory.createApplicationContext(RoleSetupModule, { logger: ['error'] });
  try {
    const db = app.get(DatabaseService);
    const users = await db.all<{id:number}>('SELECT id FROM users WHERE username=?', [username]);
    if (users.length !== 1) throw new Error('Account does not exist');
    await db.execute('UPDATE users SET role=? WHERE id=?', [role,users[0].id]);
    console.log(`Role updated: ${username} -> ${role}. Sign in again on FE.`);
  } finally { await app.close(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Role setup failed'); process.exitCode=1; });

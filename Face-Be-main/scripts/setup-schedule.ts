import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { text, utcDate } from '../src/common/validation';

@Module({ imports: [DatabaseModule] })
class SetupModule {}
async function main() {
  if (existsSync('.env')) loadEnvFile('.env');
  const [username, studentCode, roomCode, subjectCode, subjectName, teacherName, starts, ends] = process.argv.slice(2);
  if (!ends) throw new Error('Usage: npm run schedule:setup -- username studentCode roomCode subjectCode "subjectName" "teacherName" startsAt endsAt');
  const startsAt = utcDate(starts, 'startsAt'), endsAt = utcDate(ends, 'endsAt');
  if (endsAt <= startsAt) throw new Error('endsAt must be after startsAt');
  const app = await NestFactory.createApplicationContext(SetupModule, { logger: ['error'] });
  try {
    const db = app.get(DatabaseService);
    const sessionId = await db.transaction(async client => {
      const [user] = await client.all<{id:number}>('SELECT id FROM users WHERE username=?', [text(username, 'username', 50)]);
      const [student] = await client.all<{id:number}>('SELECT id FROM students WHERE studentCode=?', [text(studentCode, 'studentCode', 50)]);
      const [room] = await client.all<{id:number}>('SELECT id FROM rooms WHERE roomCode=?', [text(roomCode, 'roomCode', 50)]);
      if (!user || !student || !room) throw new Error('Create the user, student and room first');
      const links = await client.all<{userId:number;studentId:number}>('SELECT * FROM student_accounts WHERE userId=? OR studentId=?', [user.id, student.id]);
      if (links.some(link => link.userId !== user.id || link.studentId !== student.id)) throw new Error('Account/student already linked differently; refusing to overwrite');
      if (!links.length) await client.execute('INSERT INTO student_accounts(userId,studentId) VALUES(?,?)', [user.id,student.id]);
      const sessions = await client.all<{id:number;subjectName:string;teacherName:string;endsAt:string}>('SELECT * FROM learning_sessions WHERE roomId=? AND subjectCode=? AND startsAt=?', [room.id,text(subjectCode,'subjectCode',50),startsAt]);
      if (sessions.length > 1) throw new Error('Multiple matching sessions; inspect database');
      const existing = sessions[0];
      if (existing && (existing.subjectName !== subjectName || existing.teacherName !== teacherName || existing.endsAt !== endsAt)) throw new Error('Session already exists with different content');
      const id = existing?.id ?? await client.insert('INSERT INTO learning_sessions(subjectCode,subjectName,teacherName,roomId,startsAt,endsAt) VALUES(?,?,?,?,?,?)', [text(subjectCode,'subjectCode',50),text(subjectName,'subjectName'),text(teacherName,'teacherName'),room.id,startsAt,endsAt]);
      if (!(await client.all('SELECT * FROM session_students WHERE sessionId=? AND studentId=?', [id,student.id])).length) await client.execute('INSERT INTO session_students(sessionId,studentId) VALUES(?,?)', [id,student.id]);
      return id;
    });
    console.log(`Schedule ready: session ${sessionId}, student ${studentCode}, account ${username}.`);
  } finally { await app.close(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Setup failed'); process.exitCode=1; });

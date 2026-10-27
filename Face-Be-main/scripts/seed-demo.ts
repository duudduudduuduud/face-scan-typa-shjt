import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { hashPassword, verifyPassword } from '../src/auth/password';

@Module({ imports: [DatabaseModule] })
class DemoModule {}

async function main() {
  if (existsSync('.env')) loadEnvFile('.env');
  const day = process.argv[2] ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(`${day}T00:00:00+07:00`))) throw new Error('Use date YYYY-MM-DD');
  const password = 'DemoTest@123';
  const names = ['Nguyễn Minh An', 'Trần Ngọc Bình', 'Lê Hoàng Chi', 'Phạm Anh Dũng', 'Hoàng Thu Hà', 'Vũ Gia Huy', 'Đặng Bảo Linh', 'Bùi Đức Nam', 'Đỗ Thanh Phương', 'Ngô Hải Yến'];
  const hash = await hashPassword(password);
  const app = await NestFactory.createApplicationContext(DemoModule, { logger: ['error'] });
  try {
    const db = app.get(DatabaseService);
    await db.transaction(async client => {
      const account = async (username: string, fullName: string, role: string) => {
        const [existing] = await client.all<{id:number;role:string;passwordHash:string}>('SELECT id,role,passwordHash FROM users WHERE username=?', [username]);
        if (existing) {
          if (existing.role !== role || !await verifyPassword(password, existing.passwordHash)) throw new Error(`Account ${username} already exists with different credentials; refusing to overwrite`);
          return existing.id;
        }
        return client.insert('INSERT INTO users(username,fullName,passwordHash,role) VALUES(?,?,?,?)', [username,fullName,hash,role]);
      };
      await account('demo_teacher', 'Giáo viên Demo', 'teacher');
      const studentIds: number[] = [];
      for (let i=0;i<names.length;i++) {
        const code = `DEMO${String(i+1).padStart(3,'0')}`;
        const [row] = await client.all<{id:number}>('SELECT id FROM students WHERE studentCode=?', [code]);
        const id = row?.id ?? await client.insert('INSERT INTO students(studentCode,fullName) VALUES(?,?)', [code,names[i]]);
        studentIds.push(id);
        const userId = await account(`demo_sv${String(i+1).padStart(2,'0')}`, names[i], 'student');
        const links = await client.all<{userId:number;studentId:number}>('SELECT userId,studentId FROM student_accounts WHERE userId=? OR studentId=?', [userId,id]);
        if (links.some(link=>link.userId!==userId || link.studentId!==id)) throw new Error(`Conflicting account link for ${code}`);
        if (!links.length) await client.execute('INSERT INTO student_accounts(userId,studentId) VALUES(?,?)', [userId,id]);
      }
      const roomIds: number[] = [];
      for (const [code,name] of [['DEMO-LAB01','Phòng thực hành Demo'],['DEMO-A101','Phòng học Demo A101'],['DEMO-A102','Phòng học Demo A102']]) {
        const [row] = await client.all<{id:number}>('SELECT id FROM rooms WHERE roomCode=?', [code]);
        roomIds.push(row?.id ?? await client.insert('INSERT INTO rooms(roomCode,name) VALUES(?,?)', [code,name]));
      }
      for (const [index,subject,hour] of [[0,'Lập trình Python',8],[1,'Cơ sở dữ liệu',13],[2,'Trí tuệ nhân tạo',15]] as const) {
        const starts = new Date(`${day}T${String(hour).padStart(2,'0')}:00:00+07:00`).toISOString();
        const ends = new Date(Date.parse(starts)+90*60000).toISOString();
        const code = `DEMO-MON${index+1}`;
        const [row] = await client.all<{id:number}>('SELECT id FROM learning_sessions WHERE subjectCode=? AND roomId=? AND startsAt=?', [code,roomIds[index],starts]);
        const sessionId = row?.id ?? await client.insert('INSERT INTO learning_sessions(subjectCode,subjectName,teacherName,roomId,startsAt,endsAt) VALUES(?,?,?,?,?,?)', [code,subject,'Giáo viên Demo',roomIds[index],starts,ends]);
        for (const [i,studentId] of studentIds.entries()) {
          if (!(await client.all('SELECT studentId FROM session_students WHERE sessionId=? AND studentId=?', [sessionId,studentId])).length) await client.execute('INSERT INTO session_students(sessionId,studentId) VALUES(?,?)', [sessionId,studentId]);
          // Manual sample events are separate from actual camera attendance.
          for (const direction of ['in','out']) {
            const key = `demo:${day}:mon${index+1}:sv${i+1}:${direction}`;
            const at = new Date(Date.parse(direction==='in'?starts:ends)+(direction==='in'?i*60000:0)).toISOString();
            if (!(await client.all('SELECT id FROM room_events WHERE eventKey=?', [key])).length) await client.execute('INSERT INTO room_events(studentId,roomId,direction,occurredAt,source,eventKey) VALUES(?,?,?,?,?,?)', [studentId,roomIds[index],direction,at,'manual',key]);
          }
        }
      }
    });
    console.log(`Demo ready for ${day}: 11 accounts, 10 students, 3 rooms, 3 sessions, 60 manual events. Login: demo_teacher or demo_sv01..demo_sv10 / ${password}`);
  } finally { await app.close(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Seed failed'); process.exitCode=1; });

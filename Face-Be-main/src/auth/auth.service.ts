import { ROLE_VALUES, type Role } from './roles';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService, isDuplicate } from '../database/database.service';
import type { LoginBody, LoginResponse, Account } from './auth.dto';
import { hashPassword, verifyPassword } from './password';
interface UserRow extends Account {
  passwordHash: string;
}
@Injectable()
export class AuthService {
  private readonly dummyHash = hashPassword('unused-dummy-password');
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
  ) {}
  async register(data: LoginBody & { fullName: string }, authorization?: string, studentId?: number): Promise<Account> {
    let issuer: Account | null = null;
    if (authorization) {
      const match = /^Bearer ([^\s]+)$/i.exec(authorization);
      if (!match) throw new UnauthorizedException('Invalid bearer token');
      let id: number;
      try { const payload = await this.jwt.verifyAsync<{sub:string}>(match[1]); id = Number(payload.sub); }
      catch { throw new UnauthorizedException('Invalid or expired token'); }
      issuer = await this.findUser(id);
      if (!['teacher','admin'].includes(issuer.role)) throw new ForbiddenException('Only teachers can create student accounts');
    }
    const hash = await hashPassword(data.password);
    try {
      const id = await this.database.transaction(async client => {
        await client.all(`SELECT id FROM account_creation_lock WHERE id=1${this.database.dialect === 'mysql' ? ' FOR UPDATE' : ''}`);
        if (issuer) {
          const [current] = await client.all<{role:string}>('SELECT role FROM users WHERE id=?', [issuer.id]);
          if (!current || !['teacher','admin'].includes(current.role)) throw new ForbiddenException('Teacher permission is required');
        }
        const role: Role = issuer ? 'student' : 'teacher';
        if (studentId !== undefined) {
          if (!(await client.all('SELECT id FROM students WHERE id=?', [studentId])).length) throw new NotFoundException('Student does not exist');
          if ((await client.all('SELECT userId FROM student_accounts WHERE studentId=?', [studentId])).length) throw new ConflictException('Student already has an account');
        }
        const accountId = await client.insert('INSERT INTO users(username,fullName,passwordHash,role) VALUES(?,?,?,?)', [data.username,data.fullName,hash,role]);
        if (studentId !== undefined) await client.execute('INSERT INTO student_accounts(userId,studentId) VALUES(?,?)', [accountId,studentId]);
        return accountId;
      });
      return this.findUser(id);
    } catch (error) {
      if (isDuplicate(error)) throw new ConflictException('Username or student account already exists');
      throw error;
    }
  }
  async login(data: LoginBody): Promise<LoginResponse> {
    const [row] = await this.database.all<UserRow>(
      'SELECT id, username, fullName, passwordHash FROM users WHERE username = ?',
      [data.username],
    );
    const valid = await verifyPassword(
      data.password,
      row?.passwordHash ?? (await this.dummyHash),
    );
    if (!row || !valid)
      throw new UnauthorizedException('Invalid username or password');
    return {
      accessToken: await this.jwt.signAsync({ sub: String(row.id) }),
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: await this.findUser(row.id),
    };
  }
  availableStudents(): Promise<{id:number;studentCode:string;fullName:string}[]> {
    return this.database.all('SELECT s.id,s.studentCode,s.fullName FROM students s LEFT JOIN student_accounts a ON a.studentId=s.id WHERE a.userId IS NULL ORDER BY s.id');
  }
  async findUser(id: number): Promise<Account> {
    const [user] = await this.database.all<Account>(
      'SELECT id, username, fullName, role FROM users WHERE id = ?',
      [id],
    );
    if (user && !ROLE_VALUES.includes(user.role)) throw new UnauthorizedException('Account role is invalid');
    if (!user) throw new UnauthorizedException('Account no longer exists');
    const [link] = await this.database.all<{ studentId: number }>('SELECT studentId FROM student_accounts WHERE userId=?', [id]);
    return link ? { ...user, studentId: link.studentId } : user;
  }
}

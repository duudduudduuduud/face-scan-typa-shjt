import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService, isDuplicate } from '../database/database.service';
import type { CreateStudentDto, Student } from './students.dto';
@Injectable()
export class StudentsService {
  constructor(private readonly database: DatabaseService) {}
  async create(data: CreateStudentDto): Promise<Student> {
    try {
      const id = await this.database.insert(
        'INSERT INTO students (studentCode, fullName) VALUES (?, ?)',
        [data.studentCode, data.fullName],
      );
      return this.require(id);
    } catch (error) {
      if (isDuplicate(error))
        throw new ConflictException('studentCode already exists');
      throw error;
    }
  }
  findAll(): Promise<Student[]> {
    return this.database.all<Student>(
      'SELECT id, studentCode, fullName FROM students ORDER BY id',
    );
  }
  async findByCode(studentCode: string): Promise<Student> {
    const [row] = await this.database.all<Student>(
      'SELECT id, studentCode, fullName FROM students WHERE studentCode = ?',
      [studentCode],
    );
    if (!row) throw new NotFoundException('Student does not exist');
    return row;
  }
  async update(id: number, data: CreateStudentDto): Promise<Student> {
    try {
      return await this.database.transaction(async (client) => {
        if (
          !(await client.all('SELECT id FROM students WHERE id = ?', [id]))
            .length
        )
          throw new NotFoundException('Student does not exist');
        await client.execute(
          'UPDATE students SET studentCode = ?, fullName = ? WHERE id = ?',
          [data.studentCode, data.fullName, id],
        );
        return { id, ...data };
      });
    } catch (error) {
      if (isDuplicate(error))
        throw new ConflictException('studentCode already exists');
      throw error;
    }
  }
  async require(id: number): Promise<Student> {
    const [row] = await this.database.all<Student>(
      'SELECT id, studentCode, fullName FROM students WHERE id = ?',
      [id],
    );
    if (!row) throw new NotFoundException('Student does not exist');
    return row;
  }
}

import { knownIdentity, object } from '../common/validation';

export interface CreateStudentDto {
  studentCode: string;
  fullName: string;
}
export interface Student extends CreateStudentDto {
  id: number;
}

export function parseStudent(body: unknown): CreateStudentDto {
  const data = object(body, ['studentCode', 'fullName']);
  return {
    studentCode: knownIdentity(data.studentCode, 'studentCode', 50),
    fullName: knownIdentity(data.fullName, 'fullName'),
  };
}

import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifyRecognitionTicket(value: unknown, userId: number): { studentId: number; userId: number; expires: number } {
  const secret = process.env.AI_SERVICE_KEY ?? '';
  if (secret.length < 32) throw new ServiceUnavailableException('AI service key is not configured');
  if (typeof value !== 'string' || value.length > 2000) throw new BadRequestException('Recognition ticket required');
  const [encoded, signature, extra] = value.split('.');
  const expected = createHmac('sha256', secret).update(encoded ?? '').digest('base64url');
  if (!signature || extra || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new BadRequestException('Invalid recognition ticket');
  let ticket: { studentId: number; userId: number; expires: number };
  try { ticket = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as typeof ticket; }
  catch { throw new BadRequestException('Invalid recognition ticket'); }
  if (!ticket || ticket.userId !== userId || !Number.isSafeInteger(ticket.studentId) || ticket.studentId < 1 || !Number.isFinite(ticket.expires) || ticket.expires < Date.now()) throw new BadRequestException('Recognition expired or belongs to another account');
  return ticket;
}

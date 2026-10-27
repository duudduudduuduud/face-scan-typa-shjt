import { BadRequestException } from '@nestjs/common';

export function object(
  value: unknown,
  allowed: string[],
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Expected a JSON object');
  }
  const data = value as Record<string, unknown>;
  const extra = Object.keys(data).filter((key) => !allowed.includes(key));
  if (extra.length)
    throw new BadRequestException(`Unsupported fields: ${extra.join(', ')}`);
  return data;
}

export function text(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new BadRequestException(
      `${field} must be a nonempty string of at most ${max} characters`,
    );
  }
  return value.trim();
}

export function knownIdentity(
  value: unknown,
  field: string,
  max = 200,
): string {
  const result = text(value, field, max);
  if (result.toLowerCase() === 'unknown') {
    throw new BadRequestException('Unknown identities cannot be stored');
  }
  return result;
}

export function positiveInteger(
  value: unknown,
  field: string,
  query = false,
): number {
  if (query && typeof value === 'string' && /^[1-9]\d*$/.test(value))
    value = Number(value);
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return value;
}

export function choice<const T extends string>(
  value: unknown,
  field: string,
  values: readonly T[],
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new BadRequestException(
      `${field} must be one of: ${values.join(', ')}`,
    );
  }
  return value as T;
}

// Require a timezone and validate the calendar before converting to canonical UTC.
export function utcDate(value: unknown, field: string): string {
  if (typeof value !== 'string')
    throw new BadRequestException(
      `${field} must be an ISO 8601 timestamp with timezone`,
    );
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match)
    throw new BadRequestException(
      `${field} must be an ISO 8601 timestamp with timezone`,
    );
  const [, year, month, day, hour, minute, second, , zone] = match;
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const invalidZone =
    zone !== 'Z' &&
    (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59);
  if (
    Number(year) < 100 ||
    Number(month) < 1 ||
    Number(month) > 12 ||
    Number(day) < 1 ||
    Number(day) > days ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    invalidZone ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new BadRequestException(`${field} is not a valid timestamp`);
  }
  return new Date(value).toISOString();
}

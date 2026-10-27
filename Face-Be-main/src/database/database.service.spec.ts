import { createConnection, createPool } from 'mysql2/promise';
import { DatabaseService, isDuplicate } from './database.service';
import { MYSQL_SCHEMA } from './mysql-schema';

jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn(),
  createPool: jest.fn(),
}));

describe('MySQL database initialization', () => {
  const originalEnv = { ...process.env };
  let connection: { query: jest.Mock; changeUser: jest.Mock; end: jest.Mock };
  let pool: { end: jest.Mock; query: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DB_TYPE = 'mysql';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '3306';
    process.env.DB_USERNAME = 'test_user';
    process.env.DB_PASSWORD = 'test_password';
    process.env.DB_DATABASE = 'attendance_test';
    connection = {
      query: jest.fn().mockResolvedValue([[]]),
      changeUser: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
    };
    pool = {
      end: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([[{ version: 1 }]]),
    };
    jest.mocked(createConnection).mockResolvedValue(connection as never);
    jest.mocked(createPool).mockReturnValue(pool as never);
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('connects without a database, creates it, selects it, then creates all tables', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();
    expect(createConnection).toHaveBeenCalledWith(
      expect.not.objectContaining({ database: expect.anything() }),
    );
    expect(connection.query.mock.calls.map((call) => call[0])).toEqual([
      'CREATE DATABASE IF NOT EXISTS `attendance_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci',
      ...MYSQL_SCHEMA,
      "SHOW COLUMNS FROM users LIKE 'role'",
      "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'student'",
    ]);
    expect(connection.changeUser).toHaveBeenCalledWith({
      database: 'attendance_test',
    });
    expect(connection.query.mock.invocationCallOrder[0]).toBeLessThan(
      connection.changeUser.mock.invocationCallOrder[0],
    );
    expect(connection.changeUser.mock.invocationCallOrder[0]).toBeLessThan(
      connection.query.mock.invocationCallOrder[1],
    );
    expect(connection.end).toHaveBeenCalledTimes(1);
    expect(createPool).toHaveBeenCalledWith(
      expect.objectContaining({ database: 'attendance_test' }),
    );
    await database.onModuleDestroy();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('preserves an existing role column instead of altering it again', async () => {
    connection.query.mockImplementation(async (sql: string) => sql.startsWith('SHOW COLUMNS') ? [[{ Field: 'role' }]] : [[]]);
    const database = new DatabaseService();
    await database.onModuleInit();
    expect(connection.query.mock.calls.some(([sql]) => String(sql).startsWith('ALTER TABLE'))).toBe(false);
    await database.onModuleDestroy();
  });

  it('fails startup and closes the bootstrap connection when CREATE is denied', async () => {
    const failure = new Error('CREATE denied');
    connection.query.mockRejectedValueOnce(failure);
    await expect(new DatabaseService().onModuleInit()).rejects.toBe(failure);
    expect(connection.end).toHaveBeenCalledTimes(1);
    expect(createPool).not.toHaveBeenCalled();
  });

  it('propagates login failures without creating a pool', async () => {
    const failure = new Error('Access denied');
    jest.mocked(createConnection).mockRejectedValueOnce(failure);
    await expect(new DatabaseService().onModuleInit()).rejects.toBe(failure);
    expect(createPool).not.toHaveBeenCalled();
  });

  it('closes the connection if table creation fails', async () => {
    connection.query
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Table creation denied'));
    await expect(new DatabaseService().onModuleInit()).rejects.toThrow(
      'Table creation denied',
    );
    expect(connection.end).toHaveBeenCalledTimes(1);
    expect(createPool).not.toHaveBeenCalled();
  });

  it.each(['bad`name', 'bad-name', '', 'x'.repeat(65)])(
    'rejects invalid database name %s before connecting',
    async (name) => {
      process.env.DB_DATABASE = name;
      await expect(new DatabaseService().onModuleInit()).rejects.toThrow(
        'DB_DATABASE',
      );
      expect(createConnection).not.toHaveBeenCalled();
    },
  );

  it('recognizes only unique constraint errors as retries', () => {
    expect(isDuplicate({ code: 'ER_DUP_ENTRY' })).toBe(true);
    expect(isDuplicate({ code: 'ERR_SQLITE_ERROR', errcode: 2067 })).toBe(true);
    expect(isDuplicate({ code: 'ER_NO_REFERENCED_ROW_2' })).toBe(false);
    expect(isDuplicate(new Error('network failure'))).toBe(false);
  });
});

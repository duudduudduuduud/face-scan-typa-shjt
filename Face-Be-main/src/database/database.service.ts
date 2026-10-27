import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createConnection, createPool } from 'mysql2/promise';
import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';
import { SQLITE_SCHEMA } from './sqlite-schema';
import { MYSQL_SCHEMA } from './mysql-schema';

export interface QueryClient {
  all<T>(sql: string, values?: SqlValue[]): Promise<T[]>;
  insert(sql: string, values: SqlValue[]): Promise<number>;
  execute(sql: string, values?: SqlValue[]): Promise<void>;
}
export type SqlValue = string | number | null;

export function isDuplicate(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const details = error as { code?: string; errcode?: number };
  return details.code === 'ER_DUP_ENTRY' || details.errcode === 2067;
}

@Injectable()
export class DatabaseService
  implements OnModuleInit, OnModuleDestroy, QueryClient
{
  private sqlite?: DatabaseSync;
  private pool?: Pool;
  private readonly logger = new Logger(DatabaseService.name);
  private queue: Promise<void> = Promise.resolve();
  get dialect(): 'sqlite' | 'mysql' {
    return this.sqlite ? 'sqlite' : 'mysql';
  }
  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  async onModuleInit(): Promise<void> {
    const type =
      process.env.DB_TYPE ?? (process.env.DB_HOST ? 'mysql' : 'sqlite');
    if (type === 'sqlite') {
      const path = process.env.DATABASE_PATH ?? './data/attendance.sqlite';
      if (path !== ':memory:')
        mkdirSync(dirname(resolve(path)), { recursive: true });
      this.sqlite = new DatabaseSync(path);
      try {
        this.sqlite.exec(SQLITE_SCHEMA);
        const columns = this.sqlite.prepare('PRAGMA table_info(users)').all() as { name: string }[];
        if (!columns.some(column => column.name === 'role')) this.sqlite.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin','teacher','student','ai_service'))");
      } catch (error) {
        this.sqlite.close();
        this.sqlite = undefined;
        throw error;
      }
      return;
    }
    if (type !== 'mysql') throw new Error('DB_TYPE must be mysql or sqlite');
    const database = process.env.DB_DATABASE ?? 'faceid_attendance';
    if (!/^[A-Za-z0-9_]{1,64}$/.test(database))
      throw new Error(
        'DB_DATABASE must contain 1-64 letters, digits or underscores',
      );
    const port = Number(process.env.DB_PORT ?? 3306);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error('DB_PORT must be a valid port');
    const options = {
      host: process.env.DB_HOST ?? 'localhost',
      port,
      user: process.env.DB_USERNAME ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
      charset: 'utf8mb4',
      timezone: 'Z',
      connectTimeout: 10000,
    };
    // Connect without selecting a database so a missing database can be created.
    const bootstrap = await createConnection(options);
    try {
      await bootstrap.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci`,
      );
      await bootstrap.changeUser({ database });
      for (const sql of MYSQL_SCHEMA) await bootstrap.query(sql);
      const [columns] = await bootstrap.query<RowDataPacket[]>("SHOW COLUMNS FROM users LIKE 'role'");
      if (!columns.length) await bootstrap.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'student'");
    } finally {
      await bootstrap.end();
    }
    this.pool = createPool({ ...options, database, connectionLimit: 10 });
    this.logger.log(
      `MySQL ready: database ${database}, tables users, students, rooms, room_events`,
    );
  }

  async all<T>(sql: string, values: SqlValue[] = []): Promise<T[]> {
    if (this.sqlite)
      return this.exclusive(
        async () => this.sqlite!.prepare(sql).all(...values) as unknown as T[],
      );
    if (!this.pool) throw new Error('Database is not initialized');
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, values);
    return rows as unknown as T[];
  }

  async insert(sql: string, values: SqlValue[]): Promise<number> {
    if (this.sqlite)
      return this.exclusive(async () =>
        Number(this.sqlite!.prepare(sql).run(...values).lastInsertRowid),
      );
    if (!this.pool) throw new Error('Database is not initialized');
    const [result] = await this.pool.execute<ResultSetHeader>(sql, values);
    return result.insertId;
  }

  async execute(sql: string, values: SqlValue[] = []): Promise<void> {
    if (this.sqlite) {
      await this.exclusive(async () => {
        this.sqlite!.prepare(sql).run(...values);
      });
      return;
    }
    if (!this.pool) throw new Error('Database is not initialized');
    await this.pool.query(sql, values);
  }

  async transaction<T>(work: (client: QueryClient) => Promise<T>): Promise<T> {
    if (this.sqlite)
      return this.exclusive(async () => {
        const db = this.sqlite!;
        db.exec('BEGIN IMMEDIATE');
        const client: QueryClient = {
          all: async <R>(sql: string, values: SqlValue[] = []) =>
            db.prepare(sql).all(...values) as unknown as R[],
          insert: async (sql, values) =>
            Number(db.prepare(sql).run(...values).lastInsertRowid),
          execute: async (sql, values = []) => {
            db.prepare(sql).run(...values);
          },
        };
        try {
          const result = await work(client);
          db.exec('COMMIT');
          return result;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      });
    if (!this.pool) throw new Error('Database is not initialized');
    const connection = await this.pool.getConnection();
    const client: QueryClient = {
      all: async <R>(sql: string, values: SqlValue[] = []) => {
        const [rows] = await connection.query<RowDataPacket[]>(sql, values);
        return rows as unknown as R[];
      },
      insert: async (sql, values) => {
        const [result] = await connection.execute<ResultSetHeader>(sql, values);
        return result.insertId;
      },
      execute: async (sql, values = []) => {
        await connection.query(sql, values);
      },
    };
    try {
      await connection.beginTransaction();
      const result = await work(client);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async snapshot(
    queries: { sql: string; values: SqlValue[] }[],
  ): Promise<unknown[][]> {
    if (this.sqlite)
      return this.exclusive(async () => {
        const db = this.sqlite!;
        db.exec('BEGIN');
        try {
          const result = queries.map(({ sql, values }) =>
            db.prepare(sql).all(...values),
          );
          db.exec('COMMIT');
          return result;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      });
    if (!this.pool) throw new Error('Database is not initialized');
    const connection: PoolConnection = await this.pool.getConnection();
    try {
      await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await connection.beginTransaction();
      const result: unknown[][] = [];
      for (const { sql, values } of queries) {
        const [rows] = await connection.query<RowDataPacket[]>(sql, values);
        result.push(rows);
      }
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.sqlite?.close();
    await this.pool?.end();
  }
}

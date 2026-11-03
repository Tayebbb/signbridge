import type { SQL } from "drizzle-orm";
export interface SqlSession { query<T extends object = Record<string, unknown>>(query: SQL): Promise<T[]> }
export interface StateStore extends SqlSession { transaction<T>(work: (session: SqlSession) => Promise<T>): Promise<T> }
/** Driver bridge only; authority, accounting and transactions are defined in queries. */
export function sqlSession(execute: (query: SQL) => Promise<{ rows: unknown[] }>): SqlSession {
  return { async query<T extends object>(query: SQL) { return (await execute(query)).rows as T[]; } };
}

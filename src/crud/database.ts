// Database connection helper for Cloudflare D1
import { DatabaseConnection } from './base';

// Type for Cloudflare Workers Environment with D1 binding
export interface Env {
  DB: D1Database;
}

// Wrapper class to adapt D1Database to our DatabaseConnection interface
export class D1DatabaseConnection implements DatabaseConnection {
  private d1: D1Database;

  constructor(d1: D1Database) {
    this.d1 = d1;
  }

  prepare(query: string) {
    const statement = this.d1.prepare(query);
    
    return {
      bind: (...params: any[]) => {
        const boundStatement = statement.bind(...params);
        
        return {
          run: async () => {
            try {
              const result = await boundStatement.run();
              return {
                success: result.success,
                error: result.success ? undefined : 'Query execution failed',
                meta: result.meta
              };
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          },
          
          first: async <T = any>(): Promise<T | null> => {
            try {
              return await boundStatement.first<T>();
            } catch (error) {
              console.error('Database query error:', error);
              return null;
            }
          },
          
          all: async <T = any>() => {
            try {
              const result = await boundStatement.all<T>();
              return {
                results: result.results,
                success: result.success,
                error: result.success ? undefined : 'Query execution failed'
              };
            } catch (error) {
              return {
                results: [] as T[],
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          }
        };
      }
    };
  }
}

// Factory function to create database connection from Cloudflare Workers environment
export function createDatabaseConnection(env: Env): DatabaseConnection {
  return new D1DatabaseConnection(env.DB);
}

// Helper function to initialize database with schema (for development/testing)
export async function initializeDatabase(db: DatabaseConnection): Promise<boolean> {
  const initQueries = [
    // Create users table
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_login TEXT NOT NULL
    )`,

    // Create activities table
    `CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_reported TEXT,
      managerName TEXT NOT NULL,
      managerID TEXT NOT NULL,
      projectName TEXT NOT NULL
    )`,

    // Create sheets table
    `CREATE TABLE IF NOT EXISTS sheets (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      sheetID TEXT NOT NULL,
      sheetName TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // Create tasks table
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_sent TEXT,
      last_reported TEXT,
      sheetID TEXT NOT NULL,
      projectName TEXT NOT NULL,
      pageID TEXT NOT NULL,
      row_number INTEGER NOT NULL,
      ownerID TEXT NOT NULL,
      ownerName TEXT NOT NULL,
      ownerEmail TEXT NOT NULL,
      ownerPhone TEXT NOT NULL,
      managerName TEXT NOT NULL,
      points TEXT NOT NULL,
      status TEXT NOT NULL,
      taskText TEXT NOT NULL,
      priority TEXT NOT NULL,
      dueDate TEXT,
      completed_at TEXT,
      blocked_at TEXT,
      notes TEXT,
      milestone TEXT NOT NULL DEFAULT ''
    )`
  ];

  try {
    for (const query of initQueries) {
      const result = await db.prepare(query).bind().run();
      if (!result.success) {
        console.error('Failed to execute init query:', query, result.error);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}
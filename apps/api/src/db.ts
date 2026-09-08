import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'esign.db');
const rawDb = new sqlite3.Database(dbPath);

// Synchronous wrapper helpers around sqlite3 for clean route execution
export const db = {
  prepare: (sql: string) => {
    return {
      run: (...params: any[]) => {
        return new Promise<void>((resolve, reject) => {
          rawDb.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      },
      all: (...params: any[]) => {
        return new Promise<any[]>((resolve, reject) => {
          rawDb.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
      },
      get: (...params: any[]) => {
        return new Promise<any>((resolve, reject) => {
          rawDb.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      },
    };
  },
  transaction: (fn: () => Promise<void> | void) => {
    return async () => {
      rawDb.serialize(async () => {
        await fn();
      });
    };
  },
};

// Initialize database schema asynchronously
rawDb.serialize(() => {
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      source TEXT NOT NULL DEFAULT 'uploaded',
      file_path TEXT NOT NULL,
      original_file_name TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      page_count INTEGER NOT NULL DEFAULT 1,
      inbox_link_id TEXT,
      audit_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS signature_fields (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      field_type TEXT NOT NULL,
      value TEXT,
      signer_id TEXT,
      signer_email TEXT,
      required INTEGER NOT NULL DEFAULT 1
    );
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS recipients (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      signing_order INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      signed_at TEXT,
      token TEXT NOT NULL UNIQUE
    );
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS inbox_links (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      title TEXT,
      note TEXT,
      expires_at TEXT,
      max_uses INTEGER,
      current_uses INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      action TEXT NOT NULL,
      performer_email TEXT NOT NULL,
      performer_ip TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      details TEXT
    );
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      document_type TEXT NOT NULL,
      field_layout TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS usage_history (
      id TEXT PRIMARY KEY,
      document_type TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      field_layout TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
});

console.log('Database initialized at:', dbPath);

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function columnsFor(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

function addColumn(db, table, columns, definition) {
  const name = definition.trim().split(/\s+/)[0];
  if (!columns.has(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    columns.add(name);
  }
}

export function openDatabase(rootDir) {
  const dataDir = path.join(rootDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const databasePath = process.env.PROMPT_DB_PATH
    ? path.resolve(process.env.PROMPT_DB_PATH)
    : path.join(dataDir, "prompts.db");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL,
      negative_prompt TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL DEFAULT '4:5',
      published INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS provider_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      provider_name TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL DEFAULT '',
      api_type TEXT NOT NULL DEFAULT 'responses',
      model TEXT NOT NULL DEFAULT '',
      api_key_ciphertext TEXT NOT NULL DEFAULT '',
      api_key_iv TEXT NOT NULL DEFAULT '',
      api_key_auth_tag TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      daily_limit INTEGER NOT NULL DEFAULT 3,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reverse_usage (
      day TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (day, ip_hash)
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL DEFAULT '',
      password_salt TEXT NOT NULL DEFAULT '',
      auth_version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO provider_settings (id) VALUES (1);
    INSERT OR IGNORE INTO admin_settings (id) VALUES (1);
  `);

  const promptColumns = columnsFor(db, "prompts");
  addColumn(db, "prompts", promptColumns, "source_name TEXT NOT NULL DEFAULT ''");
  addColumn(db, "prompts", promptColumns, "source_url TEXT NOT NULL DEFAULT ''");
  addColumn(db, "prompts", promptColumns, "github_url TEXT NOT NULL DEFAULT ''");
  addColumn(db, "prompts", promptColumns, "styles_json TEXT NOT NULL DEFAULT '[]'");
  addColumn(db, "prompts", promptColumns, "scenes_json TEXT NOT NULL DEFAULT '[]'");
  addColumn(db, "prompts", promptColumns, "source_key TEXT");
  addColumn(db, "prompts", promptColumns, "import_rank INTEGER NOT NULL DEFAULT 0");

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS prompts_source_key_unique
      ON prompts(source_key)
      WHERE source_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS prompts_public_order
      ON prompts(published, import_rank, id);
    CREATE INDEX IF NOT EXISTS prompts_model ON prompts(model);
    CREATE INDEX IF NOT EXISTS prompts_category ON prompts(category);
  `);

  return db;
}

export function parseJsonList(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

export function serializePrompt(row) {
  return {
    ...row,
    published: Boolean(row.published),
    featured: Boolean(row.featured),
    styles: parseJsonList(row.styles_json),
    scenes: parseJsonList(row.scenes_json),
  };
}

const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const { seedDatabase } = require("./seed");

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "archive.db"));
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");

const now = () => new Date().toISOString();
const slugify = (value) => String(value || "").trim().toLowerCase()
  .replace(/[\s_]+/g, "-").replace(/[^\p{Letter}\p{Number}-]+/gu, "")
  .replace(/-+/g, "-").replace(/^-|-$/g, "") || `item-${Date.now()}`;

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '', cover_image TEXT DEFAULT '', sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, subtitle TEXT DEFAULT '',
      slug TEXT NOT NULL UNIQUE, category_id INTEGER, description TEXT DEFAULT '', cover_image TEXT DEFAULT '',
      year TEXT DEFAULT '', location TEXT DEFAULT '', is_featured INTEGER DEFAULT 0,
      is_recommended INTEGER DEFAULT 0, status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published')),
      tags TEXT DEFAULT '', sort_order INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, category_id INTEGER,
      title TEXT DEFAULT '', description TEXT DEFAULT '', file_path TEXT NOT NULL,
      original_name TEXT DEFAULT '', file_type TEXT DEFAULT '', mime_type TEXT DEFAULT '',
      size INTEGER DEFAULT 0, media_type TEXT DEFAULT 'image', tags TEXT DEFAULT '', is_hero INTEGER DEFAULT 0,
      is_selected INTEGER DEFAULT 0, is_cover INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0,
      show_in_database INTEGER DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS project_tags (
      project_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY(project_id,tag_id),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS media_tags (
      media_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY(media_id,tag_id),
      FOREIGN KEY(media_id) REFERENCES media(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '', updated_at TEXT);
  `);
  seedDatabase(db, now);
}

const getSettings = () => Object.fromEntries(
  db.prepare("SELECT key,value FROM settings").all().map((row) => [row.key,row.value])
);
function setSettings(values) {
  const statement = db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  db.transaction((entries) => entries.forEach(([key,value]) => statement.run(key,String(value ?? ""))))(Object.entries(values));
  return getSettings();
}
function replaceTagLinks(table, ownerColumn, ownerId, tagIds = []) {
  db.prepare(`DELETE FROM ${table} WHERE ${ownerColumn}=?`).run(ownerId);
  const insert = db.prepare(`INSERT OR IGNORE INTO ${table} (${ownerColumn},tag_id) VALUES (?,?)`);
  tagIds.map(Number).filter(Boolean).forEach((tagId) => insert.run(ownerId,tagId));
}

module.exports = { db, initDatabase, getSettings, setSettings, slugify, now, replaceTagLinks };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let database: any;
let initialized = false;

function loadDatabase() {
  if (!database) database = require("../../../database");
  return database;
}
function ensureDatabase() {
  const dbModule = loadDatabase();
  if (!initialized) {
    dbModule.initDatabase();
    initialized = true;
  }
  return dbModule.db;
}

export async function GET() {
  const db = ensureDatabase();
  const settings = loadDatabase().getSettings();
  const projects = db.prepare(`
    SELECT projects.*,categories.name AS category_name,categories.slug AS category_slug
    FROM projects LEFT JOIN categories ON categories.id=projects.category_id
    WHERE projects.status='published' ORDER BY projects.sort_order,projects.id
  `).all();
  const categories = db.prepare(`
    SELECT categories.*,COUNT(DISTINCT projects.id) AS project_count
    FROM categories LEFT JOIN projects ON projects.category_id=categories.id AND projects.status='published'
    WHERE categories.is_primary=1
    GROUP BY categories.id ORDER BY categories.sort_order,categories.id
  `).all();
  const hero = db.prepare(`
    SELECT * FROM media WHERE is_hero=1 ORDER BY updated_at DESC,sort_order,id DESC LIMIT 1
  `).get() || {
    file_path: settings.hero_media || settings.hero_image || "/assets/hero-default.jpg",
    media_type: settings.hero_media_type || "image"
  };
  const databasePreview = db.prepare(`
    SELECT media.*,categories.name AS category_name,categories.slug AS category_slug
    FROM media LEFT JOIN categories ON categories.id=media.category_id
    WHERE media.show_in_database=1 ORDER BY media.is_selected DESC,media.sort_order,media.id LIMIT 12
  `).all();
  const seriesProjects = projects.filter((project: any) => project.is_series);
  const recommended = seriesProjects.filter((project: any) => project.is_recommended);
  return NextResponse.json({
    settings,
    hero,
    featured: projects.filter((project: any) => project.is_featured),
    recommended: recommended.length ? recommended : seriesProjects.slice(0, 5),
    categories,
    database_preview: databasePreview
  });
}



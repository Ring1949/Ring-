export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  const db = ensureDatabase();
  const category = request.nextUrl.searchParams.get("category");
  const clauses = ["media.show_in_database=1"];
  const params: string[] = [];
  if (category && category !== "all") {
    clauses.push("categories.slug=?");
    params.push(category === "3d" ? "three-d" : category);
  }
  const rows = db.prepare(`
    SELECT media.*,projects.title AS project_title,projects.slug AS project_slug,
    categories.name AS category_name,categories.slug AS category_slug
    FROM media LEFT JOIN projects ON projects.id=media.project_id
    LEFT JOIN categories ON categories.id=media.category_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY media.sort_order,media.id
  `).all(...params);
  return NextResponse.json(rows);
}



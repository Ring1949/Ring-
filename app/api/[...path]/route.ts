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

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function isAdmin(request: NextRequest) {
  return request.cookies.get("sc_admin")?.value === "1";
}

function projectWithRelations(db: any, project: any) {
  if (!project) return null;
  project.tags = db.prepare(`
    SELECT tags.* FROM tags JOIN project_tags ON tags.id=project_tags.tag_id
    WHERE project_tags.project_id=? ORDER BY tags.name
  `).all(project.id);
  project.media = db.prepare("SELECT * FROM media WHERE project_id=? ORDER BY sort_order,id").all(project.id);
  project.category = project.category_id ? db.prepare("SELECT * FROM categories WHERE id=?").get(project.category_id) : null;
  return project;
}

const mediaSelect = `
  SELECT media.*,projects.title AS project_title,categories.name AS category_name,
  projects.year AS project_year,projects.location AS project_location,
  categories.slug AS category_slug,
  COALESCE((SELECT GROUP_CONCAT(tag_id) FROM media_tags WHERE media_tags.media_id=media.id),'') AS tag_ids
  FROM media LEFT JOIN projects ON projects.id=media.project_id
  LEFT JOIN categories ON categories.id=media.category_id
`;

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const db = ensureDatabase();
  const { path } = await context.params;
  const route = path.join("/");
  const search = request.nextUrl.searchParams;

  if (route === "me") return json({ authenticated: isAdmin(request) });
  if (route === "settings") return json(loadDatabase().getSettings());

  if (route === "categories") {
    const includeAll = search.get("all") === "true" && isAdmin(request);
    return json(db.prepare(`
      SELECT categories.*, COUNT(DISTINCT projects.id) AS project_count
      FROM categories
      LEFT JOIN projects ON projects.category_id=categories.id AND projects.status='published'
      ${includeAll ? "" : "WHERE categories.is_primary=1"}
      GROUP BY categories.id ORDER BY categories.sort_order,categories.id
    `).all());
  }

  if (route === "tags") return json(db.prepare("SELECT * FROM tags ORDER BY name").all());

  if (route === "series") {
    return json(db.prepare(`
      SELECT projects.*,categories.name AS category_name,categories.slug AS category_slug,
      COALESCE(NULLIF(projects.cover_image,''),(SELECT file_path FROM media WHERE media.project_id=projects.id AND media.media_type IN ('image','video') ORDER BY media.is_cover DESC,media.sort_order,media.id LIMIT 1)) AS series_cover,
      COALESCE((SELECT media_type FROM media WHERE media.project_id=projects.id AND media.media_type IN ('image','video') ORDER BY media.is_cover DESC,media.sort_order,media.id LIMIT 1),'image') AS series_media_type
      FROM projects LEFT JOIN categories ON categories.id=projects.category_id
      WHERE projects.status='published' AND projects.is_series=1
      ORDER BY projects.is_recommended DESC,projects.sort_order,projects.id
    `).all());
  }

  if (route === "inspiration") {
    return json(db.prepare(`
      SELECT media.*,categories.name AS category_name,categories.slug AS category_slug
      FROM media LEFT JOIN categories ON categories.id=media.category_id
      WHERE media.show_in_inspiration=1 ORDER BY media.sort_order,media.id
    `).all());
  }

  if (route === "projects") {
    const clauses: string[] = [];
    const params: any[] = [];
    if (search.get("category_id")) { clauses.push("projects.category_id=?"); params.push(Number(search.get("category_id"))); }
    if (search.get("featured") === "true") clauses.push("projects.is_featured=1");
    if (search.get("recommended") === "true") clauses.push("projects.is_recommended=1");
    if (search.get("status")) { clauses.push("projects.status=?"); params.push(search.get("status")); }
    else if (!isAdmin(request)) clauses.push("projects.status='published'");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return json(db.prepare(`
      SELECT projects.*,categories.name AS category_name,categories.slug AS category_slug
      FROM projects LEFT JOIN categories ON categories.id=projects.category_id
      ${where} ORDER BY projects.sort_order,projects.id
    `).all(...params));
  }

  if (path[0] === "projects" && path[1]) {
    const project = projectWithRelations(db, db.prepare(`
      SELECT projects.*,categories.name AS category_name,categories.slug AS category_slug
      FROM projects LEFT JOIN categories ON categories.id=projects.category_id WHERE projects.id=?
    `).get(path[1]));
    if (!project || (!isAdmin(request) && project.status !== "published")) return json({ error: "项目不存在" }, 404);
    project.related = db.prepare(`
      SELECT id,title,subtitle,cover_image,year FROM projects
      WHERE category_id=? AND id!=? AND status='published' AND is_series=?
      ORDER BY is_recommended DESC,sort_order LIMIT 4
    `).all(project.category_id, project.id, project.is_series ? 1 : 0);
    return json(project);
  }

  if (route === "media") {
    const clauses: string[] = [];
    const params: any[] = [];
    ["project_id", "category_id"].forEach((key) => {
      if (search.get(key)) { clauses.push(`media.${key}=?`); params.push(Number(search.get(key))); }
    });
    if (search.get("selected") === "true") clauses.push("media.is_selected=1");
    if (search.get("hero") === "true") clauses.push("media.is_hero=1");
    if (search.get("database") === "true") clauses.push("media.show_in_database=1");
    if (search.get("category")) { clauses.push("categories.slug=?"); params.push(search.get("category") === "3d" ? "three-d" : search.get("category")); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return json(db.prepare(`${mediaSelect} ${where} ORDER BY media.sort_order,media.id`).all(...params));
  }

  if (path[0] === "media" && path[1]) {
    const media = db.prepare(`${mediaSelect} WHERE media.id=?`).get(path[1]);
    if (!media) return json({ error: "媒体不存在" }, 404);
    return json(media);
  }

  return json({ error: "Not found" }, 404);
}


function bool(value: any) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "on" ? 1 : 0;
}

function requireAdmin(request: NextRequest) {
  return isAdmin(request) ? null : json({ error: "请先登录" }, 401);
}

function slugify(value: any) {
  return loadDatabase().slugify(value);
}

function now() {
  return loadDatabase().now();
}

function replaceTagLinks(table: string, ownerColumn: string, ownerId: number, tagIds: any[] = []) {
  loadDatabase().replaceTagLinks(table, ownerColumn, ownerId, tagIds);
}

function parseTagIds(value: any) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(String(value || "[]")); } catch { return []; }
}

function formValue(form: FormData, key: string, fallback = "") {
  const value = form.get(key);
  return typeof value === "string" ? value : fallback;
}

function removeUpload(filePath: string) {
  if (!filePath?.startsWith("/uploads/")) return;
  const fs = require("node:fs");
  const pathModule = require("node:path");
  const uploadDir = process.env.VERCEL ? pathModule.join("/tmp", "shanchuan-visual-archive-uploads") : pathModule.join(process.cwd(), "uploads");
  const absolute = pathModule.resolve(uploadDir, pathModule.basename(filePath));
  if (absolute.startsWith(uploadDir) && fs.existsSync(absolute)) fs.unlinkSync(absolute);
}

async function saveUpload(file: File | null) {
  if (!file || !file.size) return null;
  const fs = require("node:fs");
  const pathModule = require("node:path");
  const crypto = require("node:crypto");
  const { processUploadedImage } = require("../../../image-processing");
  const uploadDir = process.env.VERCEL ? pathModule.join("/tmp", "shanchuan-visual-archive-uploads") : pathModule.join(process.cwd(), "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  const ext = pathModule.extname(file.name).toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`;
  const filepath = pathModule.join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
  const multerFile: any = {
    fieldname: "file",
    originalname: file.name,
    encoding: "7bit",
    mimetype: file.type || "application/octet-stream",
    destination: uploadDir,
    filename,
    path: filepath,
    size: buffer.length
  };
  return await processUploadedImage(multerFile);
}

function inferMediaType(file: any) {
  if (file.mimetype?.startsWith("image/")) return "image";
  if (file.mimetype?.startsWith("video/")) return "video";
  return "file";
}

function syncHero(db: any, media: any) {
  if (!media?.is_hero) return;
  db.prepare("UPDATE media SET is_hero=0 WHERE id!=?").run(media.id);
  const set = db.prepare(`
    INSERT INTO settings (key,value,updated_at) VALUES (?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
  `);
  set.run("hero_media", media.file_path, now());
  set.run("hero_media_type", media.media_type, now());
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const db = ensureDatabase();
  const { path } = await context.params;
  const route = path.join("/");

  if (route === "login") {
    const body = await request.json().catch(() => ({}));
    if (String(body.password || "") !== String(process.env.ADMIN_PASSWORD || "1234")) return json({ error: "密码错误" }, 401);
    const response = json({ success: true, authenticated: true });
    response.cookies.set("sc_admin", "1", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 12, path: "/" });
    return response;
  }
  if (route === "logout") {
    const response = json({ authenticated: false });
    response.cookies.set("sc_admin", "", { httpOnly: true, maxAge: 0, path: "/" });
    return response;
  }

  const denied = requireAdmin(request);
  if (denied) return denied;

  if (route === "categories") {
    const form = await request.formData();
    const file = await saveUpload(form.get("cover") as File | null);
    const result = db.prepare(`INSERT INTO categories (name,slug,description,cover_image,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .run(formValue(form,"name"), slugify(formValue(form,"slug") || formValue(form,"name")), formValue(form,"description"), file ? `/uploads/${file.filename}` : "", Number(formValue(form,"sort_order")) || 0, now(), now());
    return json(db.prepare("SELECT * FROM categories WHERE id=?").get(result.lastInsertRowid), 201);
  }

  if (route === "tags") {
    const contentType = request.headers.get("content-type") || "";
    const body: any = contentType.includes("application/json")
      ? await request.json().catch(() => ({}))
      : Object.fromEntries((await request.formData()).entries());
    const name = String(body.name || "").trim();
    if (!name) return json({ error: "标签名称不能为空" }, 400);
    const slug = String(body.slug || slugify(name));
    const result = db.prepare("INSERT INTO tags (name,slug,created_at) VALUES (?,?,?)").run(name, slugify(slug), now());
    return json(db.prepare("SELECT * FROM tags WHERE id=?").get(result.lastInsertRowid), 201);
  }

  if (route === "projects") {
    const form = await request.formData();
    const file = await saveUpload(form.get("cover") as File | null);
    const result = db.prepare(`
      INSERT INTO projects (title,subtitle,slug,category_id,description,cover_image,year,location,tags,is_featured,is_recommended,is_series,status,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(formValue(form,"title"), formValue(form,"subtitle"), slugify(formValue(form,"slug") || formValue(form,"title")), formValue(form,"category_id") ? Number(formValue(form,"category_id")) : null, formValue(form,"description"), file ? `/uploads/${file.filename}` : "", formValue(form,"year"), formValue(form,"location"), formValue(form,"tags"), bool(form.get("is_featured")), bool(form.get("is_recommended")), bool(form.get("is_series")), formValue(form,"status") === "published" ? "published" : "draft", Number(formValue(form,"sort_order")) || 0, now(), now());
    const id = Number(result.lastInsertRowid);
    replaceTagLinks("project_tags", "project_id", id, parseTagIds(formValue(form,"tag_ids","[]")));
    return json(projectWithRelations(db, db.prepare("SELECT * FROM projects WHERE id=?").get(id)), 201);
  }

  if (route === "media/upload") {
    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    if (!files.length) return json({ error: "请选择要上传的文件" }, 400);
    const insert = db.prepare(`
      INSERT INTO media (project_id,category_id,title,description,file_path,original_name,file_type,mime_type,size,media_type,tags,camera,lens,aperture,shutter_speed,iso,captured_at,is_hero,is_selected,is_cover,show_in_database,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const created = [];
    for (let index = 0; index < files.length; index += 1) {
      const saved = await saveUpload(files[index]);
      const mediaType = inferMediaType(saved);
      const ext = require("node:path").extname(saved.originalname).slice(1).toLowerCase();
      const result = insert.run(formValue(form,"project_id") ? Number(formValue(form,"project_id")) : null, formValue(form,"category_id") ? Number(formValue(form,"category_id")) : null, formValue(form,"title") || saved.originalname, formValue(form,"description"), `/uploads/${saved.filename}`, saved.originalname, ext, saved.mimetype, saved.size, mediaType, formValue(form,"tags"), formValue(form,"camera") || saved.metadata?.camera || "", formValue(form,"lens") || saved.metadata?.lens || "", formValue(form,"aperture") || saved.metadata?.aperture || "", formValue(form,"shutter_speed") || saved.metadata?.shutter_speed || "", formValue(form,"iso") || saved.metadata?.iso || "", formValue(form,"captured_at") || saved.metadata?.captured_at || "", index === 0 ? bool(form.get("is_hero")) : 0, bool(form.get("is_selected")), mediaType === "image" ? bool(form.get("is_cover")) : 0, bool(form.get("show_in_database")), (Number(formValue(form,"sort_order")) || 0) + index, now(), now());
      const id = Number(result.lastInsertRowid);
      if (form.get("tag_ids")) replaceTagLinks("media_tags", "media_id", id, parseTagIds(formValue(form,"tag_ids","[]")));
      const media = db.prepare("SELECT * FROM media WHERE id=?").get(id);
      syncHero(db, media);
      created.push(media);
    }
    return json(created, 201);
  }

  return json({ error: "Not found" }, 404);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const db = ensureDatabase();
  const { path } = await context.params;
  const denied = requireAdmin(request);
  if (denied) return denied;

  if (path[0] === "settings") {
    const body = await request.json().catch(() => ({}));
    return json(loadDatabase().setSettings(body || {}));
  }

  if (path[0] === "categories" && path[1]) {
    const existing = db.prepare("SELECT * FROM categories WHERE id=?").get(path[1]);
    if (!existing) return json({ error: "分类不存在" }, 404);
    const form = await request.formData();
    const file = await saveUpload(form.get("cover") as File | null);
    const cover = file ? `/uploads/${file.filename}` : formValue(form,"cover_image", existing.cover_image);
    if (file) removeUpload(existing.cover_image);
    db.prepare("UPDATE categories SET name=?,slug=?,description=?,cover_image=?,sort_order=?,updated_at=? WHERE id=?")
      .run(formValue(form,"name",existing.name), slugify(formValue(form,"slug",existing.slug)), formValue(form,"description",existing.description), cover, Number(formValue(form,"sort_order",String(existing.sort_order))) || 0, now(), path[1]);
    return json(db.prepare("SELECT * FROM categories WHERE id=?").get(path[1]));
  }

  if (path[0] === "projects" && path[1]) {
    const existing = db.prepare("SELECT * FROM projects WHERE id=?").get(path[1]);
    if (!existing) return json({ error: "项目不存在" }, 404);
    const form = await request.formData();
    const file = await saveUpload(form.get("cover") as File | null);
    const cover = file ? `/uploads/${file.filename}` : formValue(form,"cover_image", existing.cover_image);
    if (file) removeUpload(existing.cover_image);
    db.prepare(`UPDATE projects SET title=?,subtitle=?,slug=?,category_id=?,description=?,cover_image=?,year=?,location=?,tags=?,is_featured=?,is_recommended=?,is_series=?,status=?,sort_order=?,updated_at=? WHERE id=?`)
      .run(formValue(form,"title",existing.title), formValue(form,"subtitle",existing.subtitle), slugify(formValue(form,"slug",existing.slug)), formValue(form,"category_id") ? Number(formValue(form,"category_id")) : null, formValue(form,"description",existing.description), cover, formValue(form,"year",existing.year), formValue(form,"location",existing.location), formValue(form,"tags",existing.tags), bool(form.get("is_featured")), bool(form.get("is_recommended")), form.get("is_series") === null ? existing.is_series : bool(form.get("is_series")), formValue(form,"status") === "published" ? "published" : "draft", Number(formValue(form,"sort_order",String(existing.sort_order))) || 0, now(), path[1]);
    if (form.get("tag_ids") !== null) replaceTagLinks("project_tags", "project_id", Number(path[1]), parseTagIds(formValue(form,"tag_ids","[]")));
    return json(projectWithRelations(db, db.prepare("SELECT * FROM projects WHERE id=?").get(path[1])));
  }

  if (path[0] === "media" && path[1]) {
    const existing = db.prepare("SELECT * FROM media WHERE id=?").get(path[1]);
    if (!existing) return json({ error: "媒体不存在" }, 404);
    const body = await request.json();
    db.prepare(`UPDATE media SET project_id=?,category_id=?,title=?,description=?,tags=?,camera=?,lens=?,aperture=?,shutter_speed=?,iso=?,captured_at=?,is_hero=?,is_selected=?,is_cover=?,show_in_database=?,sort_order=?,updated_at=? WHERE id=?`)
      .run(body.project_id ? Number(body.project_id) : null, body.category_id ? Number(body.category_id) : null, body.title ?? existing.title, body.description ?? existing.description, body.tags ?? existing.tags, body.camera ?? existing.camera, body.lens ?? existing.lens, body.aperture ?? existing.aperture, body.shutter_speed ?? existing.shutter_speed, body.iso ?? existing.iso, body.captured_at ?? existing.captured_at, bool(body.is_hero), bool(body.is_selected), bool(body.is_cover), bool(body.show_in_database), Number(body.sort_order ?? existing.sort_order), now(), path[1]);
    if (body.tag_ids !== undefined) replaceTagLinks("media_tags", "media_id", Number(path[1]), parseTagIds(body.tag_ids));
    const media = db.prepare("SELECT * FROM media WHERE id=?").get(path[1]);
    syncHero(db, media);
    return json(media);
  }

  return json({ error: "Not found" }, 404);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const db = ensureDatabase();
  const { path } = await context.params;
  const denied = requireAdmin(request);
  if (denied) return denied;

  if (path[0] === "tags" && path[1]) { db.prepare("DELETE FROM tags WHERE id=?").run(path[1]); return json({ deleted: true }); }
  if (path[0] === "categories" && path[1]) {
    const existing = db.prepare("SELECT * FROM categories WHERE id=?").get(path[1]);
    if (!existing) return json({ error: "分类不存在" }, 404);
    removeUpload(existing.cover_image);
    db.prepare("DELETE FROM categories WHERE id=?").run(path[1]);
    return json({ deleted: true });
  }
  if (path[0] === "projects" && path[1]) {
    const existing = db.prepare("SELECT * FROM projects WHERE id=?").get(path[1]);
    if (!existing) return json({ error: "项目不存在" }, 404);
    removeUpload(existing.cover_image);
    db.prepare("SELECT file_path FROM media WHERE project_id=?").all(path[1]).forEach((media: any) => removeUpload(media.file_path));
    db.prepare("DELETE FROM projects WHERE id=?").run(path[1]);
    return json({ deleted: true });
  }
  if (path[0] === "media" && path[1]) {
    const existing = db.prepare("SELECT * FROM media WHERE id=?").get(path[1]);
    if (!existing) return json({ error: "媒体不存在" }, 404);
    removeUpload(existing.file_path);
    db.prepare("DELETE FROM media WHERE id=?").run(path[1]);
    return json({ deleted: true });
  }
  return json({ error: "Not found" }, 404);
}



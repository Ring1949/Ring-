module.exports = function registerContentApi(app, tools) {
  const { db, upload, requireAuth, slugify, now, replaceTagLinks, bool, removeUpload, processUploadedImage } = tools;

  function projectWithRelations(project) {
    if (!project) return null;
    project.tags = db.prepare(`
      SELECT tags.* FROM tags JOIN project_tags ON tags.id=project_tags.tag_id
      WHERE project_tags.project_id=? ORDER BY tags.name
    `).all(project.id);
    project.media = db.prepare("SELECT * FROM media WHERE project_id=? ORDER BY sort_order,id").all(project.id);
    project.category = project.category_id ? db.prepare("SELECT * FROM categories WHERE id=?").get(project.category_id) : null;
    return project;
  }

  app.get("/api/projects", (request, response) => {
    const clauses = [], params = [];
    if (request.query.category_id) { clauses.push("projects.category_id=?"); params.push(Number(request.query.category_id)); }
    if (request.query.featured === "true") clauses.push("projects.is_featured=1");
    if (request.query.recommended === "true") clauses.push("projects.is_recommended=1");
    if (request.query.status) { clauses.push("projects.status=?"); params.push(request.query.status); }
    else if (!request.session.admin) clauses.push("projects.status='published'");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    response.json(db.prepare(`
      SELECT projects.*,categories.name AS category_name,categories.slug AS category_slug
      FROM projects LEFT JOIN categories ON categories.id=projects.category_id
      ${where} ORDER BY projects.sort_order,projects.id
    `).all(...params));
  });

  app.get("/api/projects/:id", (request, response) => {
    const project = projectWithRelations(db.prepare(`
      SELECT projects.*,categories.name AS category_name,categories.slug AS category_slug
      FROM projects LEFT JOIN categories ON categories.id=projects.category_id WHERE projects.id=?
    `).get(request.params.id));
    if (!project || (!request.session.admin && project.status !== "published")) return response.status(404).json({ error: "项目不存在" });
    project.related = db.prepare(`
      SELECT id,title,subtitle,cover_image,year FROM projects
      WHERE category_id=? AND id!=? AND status='published' AND is_series=?
      ORDER BY is_recommended DESC,sort_order LIMIT 4
    `).all(project.category_id, project.id, project.is_series ? 1 : 0);
    response.json(project);
  });

  app.post("/api/projects", requireAuth, upload.single("cover"), async (request, response) => {
    const body = request.body;
    if (request.file) request.file = await processUploadedImage(request.file);
    const result = db.prepare(`
      INSERT INTO projects
      (title,subtitle,slug,category_id,description,cover_image,year,location,tags,is_featured,is_recommended,is_series,status,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(body.title, body.subtitle || "", slugify(body.slug || body.title),
      body.category_id ? Number(body.category_id) : null, body.description || "",
      request.file ? `/uploads/${request.file.filename}` : "", body.year || "", body.location || "", body.tags || "",
      bool(body.is_featured), bool(body.is_recommended), bool(body.is_series), body.status === "published" ? "published" : "draft",
      Number(body.sort_order) || 0, now(), now());
    const id = Number(result.lastInsertRowid);
    replaceTagLinks("project_tags", "project_id", id, JSON.parse(body.tag_ids || "[]"));
    response.status(201).json(projectWithRelations(db.prepare("SELECT * FROM projects WHERE id=?").get(id)));
  });

  app.put("/api/projects/:id", requireAuth, upload.single("cover"), async (request, response) => {
    const existing = db.prepare("SELECT * FROM projects WHERE id=?").get(request.params.id);
    if (!existing) return response.status(404).json({ error: "项目不存在" });
    const body = request.body;
    if (request.file) request.file = await processUploadedImage(request.file);
    const cover = request.file ? `/uploads/${request.file.filename}` : body.cover_image ?? existing.cover_image;
    if (request.file) removeUpload(existing.cover_image);
    db.prepare(`
      UPDATE projects SET title=?,subtitle=?,slug=?,category_id=?,description=?,cover_image=?,
      year=?,location=?,tags=?,is_featured=?,is_recommended=?,is_series=?,status=?,sort_order=?,updated_at=? WHERE id=?
    `).run(body.title ?? existing.title, body.subtitle ?? existing.subtitle, slugify(body.slug || existing.slug),
      body.category_id ? Number(body.category_id) : null, body.description ?? existing.description, cover,
      body.year ?? existing.year, body.location ?? existing.location, body.tags ?? existing.tags, bool(body.is_featured),
      bool(body.is_recommended), body.is_series === undefined ? existing.is_series : bool(body.is_series), body.status === "published" ? "published" : "draft",
      Number(body.sort_order ?? existing.sort_order), now(), request.params.id);
    if (body.tag_ids !== undefined) replaceTagLinks("project_tags", "project_id", Number(request.params.id), JSON.parse(body.tag_ids || "[]"));
    response.json(projectWithRelations(db.prepare("SELECT * FROM projects WHERE id=?").get(request.params.id)));
  });

  app.delete("/api/projects/:id", requireAuth, (request, response) => {
    const existing = db.prepare("SELECT * FROM projects WHERE id=?").get(request.params.id);
    if (!existing) return response.status(404).json({ error: "项目不存在" });
    removeUpload(existing.cover_image);
    db.prepare("SELECT file_path FROM media WHERE project_id=?").all(request.params.id).forEach((media) => removeUpload(media.file_path));
    db.prepare("DELETE FROM projects WHERE id=?").run(request.params.id);
    response.json({ deleted: true });
  });

  registerMediaApi(app, tools);
};

function registerMediaApi(app, tools) {
  const { db, upload, requireAuth, now, replaceTagLinks, bool, removeUpload, processUploadedImage } = tools;

    const mediaSelect = `
      SELECT media.*,projects.title AS project_title,categories.name AS category_name,
      projects.year AS project_year,projects.location AS project_location,
      categories.slug AS category_slug,
    COALESCE((SELECT GROUP_CONCAT(tag_id) FROM media_tags WHERE media_tags.media_id=media.id),'') AS tag_ids
    FROM media LEFT JOIN projects ON projects.id=media.project_id
    LEFT JOIN categories ON categories.id=media.category_id
  `;
  const inferMediaType = (file) => {
    if (file.mimetype.startsWith("image/")) return "image";
    if (file.mimetype.startsWith("video/")) return "video";
    return "file";
  };
  const parseTagIds = (value) => {
    if (Array.isArray(value)) return value;
    try { return JSON.parse(value || "[]"); } catch { return []; }
  };
  const syncHero = (media) => {
    if (!media?.is_hero) return;
    db.prepare("UPDATE media SET is_hero=0 WHERE id!=?").run(media.id);
    const set = db.prepare(`
      INSERT INTO settings (key,value,updated_at) VALUES (?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
    `);
    set.run("hero_media", media.file_path, now());
    set.run("hero_media_type", media.media_type, now());
  };

  app.get("/api/media", (request, response) => {
    const clauses = [], params = [];
    ["project_id","category_id"].forEach((key) => {
      if (request.query[key]) { clauses.push(`media.${key}=?`); params.push(Number(request.query[key])); }
    });
    if (request.query.selected === "true") clauses.push("media.is_selected=1");
    if (request.query.hero === "true") clauses.push("media.is_hero=1");
    if (request.query.database === "true") clauses.push("media.show_in_database=1");
    if (request.query.category) {
      clauses.push("categories.slug=?");
      params.push(request.query.category === "3d" ? "three-d" : request.query.category);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    response.json(db.prepare(`${mediaSelect} ${where} ORDER BY media.sort_order,media.id`).all(...params));
  });

  app.get("/api/media/:id", (request, response) => {
    const media = db.prepare(`${mediaSelect} WHERE media.id=?`).get(request.params.id);
    if (!media) return response.status(404).json({ error: "媒体不存在" });
    response.json(media);
  });

  app.post("/api/media/upload", requireAuth, upload.array("files", 30), async (request, response) => {
    const body = request.body;
    if (!request.files?.length) return response.status(400).json({ error: "请选择要上传的文件" });
    request.files = await Promise.all(request.files.map(processUploadedImage));
    const insert = db.prepare(`
      INSERT INTO media
      (project_id,category_id,title,description,file_path,original_name,file_type,mime_type,size,media_type,tags,
       camera,lens,aperture,shutter_speed,iso,captured_at,
       is_hero,is_selected,is_cover,show_in_database,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const created = (request.files || []).map((file, index) => {
      const mediaType = inferMediaType(file);
      const metadata = file.metadata || {};
      const extension = require("path").extname(file.originalname).slice(1).toLowerCase();
      const result = insert.run(
        body.project_id ? Number(body.project_id) : null, body.category_id ? Number(body.category_id) : null,
        body.title || file.originalname, body.description || "", `/uploads/${file.filename}`,
        file.originalname, extension, file.mimetype, file.size, mediaType, body.tags || "",
        body.camera || metadata.camera || "", body.lens || metadata.lens || "", body.aperture || metadata.aperture || "",
        body.shutter_speed || metadata.shutter_speed || "", body.iso || metadata.iso || "", body.captured_at || metadata.captured_at || "",
        index === 0 ? bool(body.is_hero) : 0, bool(body.is_selected),
        mediaType === "image" ? bool(body.is_cover) : 0, bool(body.show_in_database),
        Number(body.sort_order || 0) + index, now(), now()
      );
      const id = Number(result.lastInsertRowid);
      if (body.tag_ids) replaceTagLinks("media_tags", "media_id", id, parseTagIds(body.tag_ids));
      const media = db.prepare("SELECT * FROM media WHERE id=?").get(id);
      syncHero(media);
      return media;
    });
    response.status(201).json(created);
  });

  app.put("/api/media/:id", requireAuth, (request, response) => {
    const existing = db.prepare("SELECT * FROM media WHERE id=?").get(request.params.id);
    if (!existing) return response.status(404).json({ error: "媒体不存在" });
    const body = request.body;
    db.prepare(`
      UPDATE media SET project_id=?,category_id=?,title=?,description=?,tags=?,
      camera=?,lens=?,aperture=?,shutter_speed=?,iso=?,captured_at=?,
      is_hero=?,is_selected=?,is_cover=?,show_in_database=?,sort_order=?,updated_at=? WHERE id=?
    `).run(body.project_id ? Number(body.project_id) : null, body.category_id ? Number(body.category_id) : null,
      body.title ?? existing.title, body.description ?? existing.description, body.tags ?? existing.tags,
      body.camera ?? existing.camera, body.lens ?? existing.lens, body.aperture ?? existing.aperture,
      body.shutter_speed ?? existing.shutter_speed, body.iso ?? existing.iso, body.captured_at ?? existing.captured_at,
      bool(body.is_hero), bool(body.is_selected), bool(body.is_cover),
      bool(body.show_in_database), Number(body.sort_order ?? existing.sort_order), now(), request.params.id);
    if (body.tag_ids !== undefined) {
      replaceTagLinks("media_tags", "media_id", Number(request.params.id), parseTagIds(body.tag_ids));
    }
    const media = db.prepare("SELECT * FROM media WHERE id=?").get(request.params.id);
    syncHero(media);
    response.json(media);
  });

  app.delete("/api/media/:id", requireAuth, (request, response) => {
    const existing = db.prepare("SELECT * FROM media WHERE id=?").get(request.params.id);
    if (!existing) return response.status(404).json({ error: "媒体不存在" });
    removeUpload(existing.file_path);
    db.prepare("DELETE FROM media WHERE id=?").run(request.params.id);
    response.json({ deleted: true });
  });
}

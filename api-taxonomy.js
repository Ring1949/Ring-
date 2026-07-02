module.exports = function registerTaxonomyApi(app, tools) {
  const { db, upload, requireAuth, slugify, now, removeUpload, processUploadedImage } = tools;

  app.get("/api/categories", (request, response) => {
    const includeAll = request.query.all === "true" && request.session.admin;
    response.json(db.prepare(`
      SELECT categories.*, COUNT(DISTINCT projects.id) AS project_count
      FROM categories
      LEFT JOIN projects ON projects.category_id=categories.id AND projects.status='published'
      ${includeAll ? "" : "WHERE categories.is_primary=1"}
      GROUP BY categories.id ORDER BY categories.sort_order,categories.id
    `).all());
  });

  app.post("/api/categories", requireAuth, upload.single("cover"), async (request, response) => {
    const body = request.body;
    if (request.file) request.file = await processUploadedImage(request.file);
    const result = db.prepare(`
      INSERT INTO categories (name,slug,description,cover_image,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)
    `).run(body.name, slugify(body.slug || body.name), body.description || "",
      request.file ? `/uploads/${request.file.filename}` : "", Number(body.sort_order) || 0, now(), now());
    response.status(201).json(db.prepare("SELECT * FROM categories WHERE id=?").get(result.lastInsertRowid));
  });

  app.put("/api/categories/:id", requireAuth, upload.single("cover"), async (request, response) => {
    const existing = db.prepare("SELECT * FROM categories WHERE id=?").get(request.params.id);
    if (!existing) return response.status(404).json({ error: "分类不存在" });
    if (request.file) request.file = await processUploadedImage(request.file);
    const cover = request.file ? `/uploads/${request.file.filename}` : request.body.cover_image ?? existing.cover_image;
    if (request.file) removeUpload(existing.cover_image);
    db.prepare("UPDATE categories SET name=?,slug=?,description=?,cover_image=?,sort_order=?,updated_at=? WHERE id=?")
      .run(request.body.name ?? existing.name, slugify(request.body.slug || existing.slug),
        request.body.description ?? existing.description, cover,
        Number(request.body.sort_order ?? existing.sort_order), now(), request.params.id);
    response.json(db.prepare("SELECT * FROM categories WHERE id=?").get(request.params.id));
  });

  app.delete("/api/categories/:id", requireAuth, (request, response) => {
    const existing = db.prepare("SELECT * FROM categories WHERE id=?").get(request.params.id);
    if (!existing) return response.status(404).json({ error: "分类不存在" });
    removeUpload(existing.cover_image);
    db.prepare("DELETE FROM categories WHERE id=?").run(request.params.id);
    response.json({ deleted: true });
  });

  app.get("/api/tags", (_request, response) => {
    response.json(db.prepare("SELECT * FROM tags ORDER BY name").all());
  });
  app.post("/api/tags", requireAuth, (request, response) => {
    const result = db.prepare("INSERT INTO tags (name,slug,created_at) VALUES (?,?,?)")
      .run(request.body.name, slugify(request.body.slug || request.body.name), now());
    response.status(201).json(db.prepare("SELECT * FROM tags WHERE id=?").get(result.lastInsertRowid));
  });
  app.delete("/api/tags/:id", requireAuth, (request, response) => {
    db.prepare("DELETE FROM tags WHERE id=?").run(request.params.id);
    response.json({ deleted: true });
  });
};

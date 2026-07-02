const registerTaxonomyApi = require("./api-taxonomy");
const registerContentApi = require("./api-content");

module.exports = function registerApi(app, tools) {
  const { db, getSettings, setSettings, requireAuth } = tools;

  app.post("/api/login", (request, response) => {
    // Production deployments should always set ADMIN_PASSWORD in .env.
    if (String(request.body.password || "") !== String(process.env.ADMIN_PASSWORD || "1234")) {
      return response.status(401).json({ error: "密码错误" });
    }
    request.session.admin = true;
    request.session.save((error) => {
      if (error) {
        console.error("Session save failed:", error);
        return response.status(500).json({ error: "登录状态保存失败" });
      }
      response.json({ success: true, authenticated: true });
    });
  });
  app.post("/api/logout", (request, response) => request.session.destroy(() => response.json({ authenticated: false })));
  app.get("/api/me", (request, response) => response.json({ authenticated: Boolean(request.session.admin) }));

  app.get("/api/settings", (_request, response) => response.json(getSettings()));
  app.put("/api/settings", requireAuth, (request, response) => response.json(setSettings(request.body || {})));

  app.get("/api/home", (_request, response) => {
    const settings = getSettings();
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
    const seriesProjects = projects.filter((project) => project.is_series);
    const recommended = seriesProjects.filter((project) => project.is_recommended);
    response.json({
      settings,
      hero,
      featured: projects.filter((project) => project.is_featured),
      recommended: recommended.length ? recommended : seriesProjects.slice(0,5),
      categories,
      database_preview: databasePreview
    });
  });

  app.get("/api/database", (request, response) => {
    const clauses = ["media.show_in_database=1"], params = [];
    if (request.query.category) {
      clauses.push("categories.slug=?");
      params.push(request.query.category === "3d" ? "three-d" : request.query.category);
    }
    response.json(db.prepare(`
      SELECT media.*,projects.title AS project_title,projects.slug AS project_slug,
      categories.name AS category_name,categories.slug AS category_slug
      FROM media LEFT JOIN projects ON projects.id=media.project_id
      LEFT JOIN categories ON categories.id=media.category_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY media.sort_order,media.id
    `).all(...params));
  });

  app.get("/api/inspiration", (_request, response) => {
    response.json(db.prepare(`
      SELECT media.*,categories.name AS category_name,categories.slug AS category_slug
      FROM media LEFT JOIN categories ON categories.id=media.category_id
      WHERE media.show_in_inspiration=1 ORDER BY media.sort_order,media.id
    `).all());
  });
  app.get("/api/series", (_request, response) => {
    response.json(db.prepare(`
      SELECT projects.*,categories.name AS category_name,categories.slug AS category_slug,
      COALESCE(NULLIF(projects.cover_image,''),(SELECT file_path FROM media WHERE media.project_id=projects.id AND media.media_type IN ('image','video') ORDER BY media.is_cover DESC,media.sort_order,media.id LIMIT 1)) AS series_cover,
      COALESCE((SELECT media_type FROM media WHERE media.project_id=projects.id AND media.media_type IN ('image','video') ORDER BY media.is_cover DESC,media.sort_order,media.id LIMIT 1),'image') AS series_media_type
      FROM projects LEFT JOIN categories ON categories.id=projects.category_id
      WHERE projects.status='published' AND projects.is_series=1
      ORDER BY projects.is_recommended DESC,projects.sort_order,projects.id
    `).all());
  });

  registerTaxonomyApi(app, tools);
  registerContentApi(app, tools);
};

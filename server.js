require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const database = require("./database");
const registerApi = require("./api");
const { processUploadedImage } = require("./image-processing");

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");
const uploadDir = process.env.VERCEL
  ? path.join("/tmp", "shanchuan-visual-archive-uploads")
  : path.join(__dirname, "..", "制作网站素材图片", "02-后台上传素材");
fs.mkdirSync(uploadDir, { recursive: true });
database.initDatabase();

app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "local-development-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 12 }
}));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadDir),
    filename: (_request, file, callback) => callback(
      null,
      `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${path.extname(file.originalname).toLowerCase()}`
    )
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 30, fields: 40 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = new Set([
      ".jpg",".jpeg",".png",".webp",".gif",
      ".mp4",".mov",".webm",
      ".pdf",".zip",".doc",".docx",".xls",".xlsx",".ppt",".pptx",".txt",".dwg"
    ]);
    const allowed = allowedExtensions.has(extension);
    callback(allowed ? null : new Error("不支持此文件格式"), allowed);
  }
});

const requireAuth = (request, response, next) => {
  if (!request.session.admin) return response.status(401).json({ error: "请先登录" });
  next();
};
const bool = (value) => value === true || value === 1 || value === "1" || value === "true" || value === "on" ? 1 : 0;
const removeUpload = (filePath) => {
  if (!filePath?.startsWith("/uploads/")) return;
  const absolute = path.resolve(uploadDir, path.basename(filePath));
  if (absolute.startsWith(uploadDir) && fs.existsSync(absolute)) fs.unlinkSync(absolute);
};

registerApi(app, { ...database, upload, requireAuth, bool, removeUpload, processUploadedImage });
app.get("/healthz", (_request, response) => {
  response.json({ ok: true, time: new Date().toISOString() });
});
app.use("/uploads", express.static(uploadDir));
app.use((request, response, next) => {
  if (request.path === "/admin" || request.path === "/admin.html" || /^\/admin.*\.(?:css|js)$/.test(request.path)) {
    response.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }
  next();
});
app.use(express.static(publicDir));
app.get("/admin", (_request, response) => response.sendFile(path.join(publicDir, "admin.html")));
app.use((_request, response) => response.sendFile(path.join(publicDir, "index.html")));
app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(400).json({ error: error.message || "请求失败" });
});

process.on("unhandledRejection", (error) => {
  console.error("[unhandledRejection]", error);
});

process.on("uncaughtException", (error) => {
  console.error("[uncaughtException]", error);
});

if (require.main === module) {
  const server = app.listen(port, "127.0.0.1", () => {
    console.log(`灞卞窛姝㈣锛歨ttp://localhost:${port}`);
    console.log(`鍚庡彴绠＄悊锛歨ttp://localhost:${port}/admin`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Close the old local site process or use scripts/keep-site-online.ps1.`);
    } else {
      console.error("[serverError]", error);
    }
    process.exitCode = 1;
  });
}

module.exports = app;
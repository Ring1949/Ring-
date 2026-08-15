# 文件存储审计与 Cloudflare R2 渐进迁移

审计日期：2026-08-14。范围：`D:\codex\Ring-main-site`。本次没有删除旧配置、旧代码或旧文件，也没有执行批量迁移。

## A. 当前存储架构

| 页面/功能 | 迁移前存储与读取 | 本次后的新写入 | 旧资产兼容 |
| --- | --- | --- | --- |
| 首页 `/` | `/public/assets`、`/public/recovered`、Supabase `settings/media` URL、恢复数据 | Hero 由浏览器经预签名 URL 直传 R2 | 原相对路径及 Supabase URL 不变 |
| 作品/系列/项目页 | Supabase `projects/media/categories`、恢复数据、`/public/portfolio-static`，封面覆盖清单在 Vercel Blob | 统一封面和作品文件优先 R2；新清单写 R2 | 旧 Blob 清单会继续读取，旧 URL 原样使用 |
| 图库 `/database.html` | 恢复数据 + 1,203 项静态图库索引 + Supabase media + Blob media 清单 | 新作品优先 R2 | 四种来源合并去重，不改旧 URL |
| 旧后台 `/admin` | 小文件经 Server Function 到 Supabase；大文件通过 Supabase signed URL 直传 | 所有媒体/Hero 优先 R2 signed PUT 直传；未配置 R2 时回退 Supabase | 原 Supabase 上传函数完整保留 |
| 新后台 `/admin/uploads` | Vercel Blob 客户端直传，元数据清单也在 Blob | 浏览器直传 R2；图片同时生成 640px WebP 缩略图；清单优先写 R2 | R2 未配置时回退 Blob；旧 Blob 清单继续读取 |
| Skill 后台 | Vercel Blob 文件与清单 | 文件和清单优先 R2 | 旧 Blob 文件、下载 URL、清单继续有效 |
| 图谱后台 | 图片在 Vercel Blob；图谱 JSON 在 Supabase settings | 新图片优先 R2；图谱关系仍在 Supabase | 旧图谱图片 URL 不变 |

### 本地与仓库资产

- `public`：1,294 个媒体文件，约 592 MB。主要风险集中在 `public/recovered`（78 个，约 387 MB）和 `public/portfolio-static`。
- `.photo-import-cache`：4,241 个媒体缓存，约 522 MB；不属于线上读取路径，且已受 Git 忽略规则保护。
- `components`：2 个二进制资产，约 2.47 MB（包括 3D/图片组件资源）。
- 未发现 `src/assets`。
- `localStorage` 仅保存 `site-language` 与 `site-theme`，没有文件本体；未发现 IndexedDB 文件存储。

### 与存储有关的变量

- 保留：`BLOB_READ_WRITE_TOKEN`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_MEDIA_BUCKET`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_SUPABASE_URL`。
- 新增且仅服务端读取：`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME`、`R2_ENDPOINT`。
- 推荐新增：`R2_PUBLIC_BASE_URL`，用于 R2 自定义公开读取域名；未配置时使用 `/api/r2/object/...` 兼容代理。
- 限制变量：`MEDIA_FILE_MAX_BYTES`、`SKILL_FILE_MAX_BYTES`。

### 数据库 URL 与字段

- `categories.cover_image`、`projects.cover_image`、`media.file_path`、`settings.hero_media` 保存 URL。
- `media.storage_path` 保存历史 Supabase 路径或新 R2 object key。
- 增量字段：`object_key`、`storage_provider`、`width`、`height`。
- 原文件名、MIME、大小、分类、标签、项目 ID、上传时间继续使用现有字段；文件本体不进入数据库。

### 主要风险

1. 不能把 `R2_ENDPOINT` 当作公开图片域名；它是 S3 API 端点。生产读取应配置 `R2_PUBLIC_BASE_URL`。
2. 浏览器 PUT 必须配置桶 CORS，否则签名正确也会被浏览器阻止。
3. 删除时必须按 `storage_provider` 分流；兼容层已处理 R2、Supabase 和 Blob，禁止仅从 URL 猜测后批量删除。
4. 旧 URL 分散在数据库、恢复数据、静态 JSON 和 Blob 清单中，不应批量替换。
5. 数据库增量 SQL 未执行前，代码会回退旧字段写入；执行后才会完整保存 R2 provider、object key 和宽高。

## B. 修改文件

- R2 核心与直传：`lib/r2.ts`、`lib/storage-client.ts`、`app/api/r2/upload-url/route.ts`、`app/api/r2/object/[...key]/route.ts`。
- 兼容层：`lib/blob-library.ts`、`services/archive.service.ts`、Blob media/skills/cover/health API。
- 上传 UI：三个 React 后台客户端，以及 `public/admin-base.js`、`public/admin-extension.js`。
- 图库性能：`public/database.js`、`public/database.css`。
- 数据库：`supabase/schema.sql`、`supabase/migrations/20260814_add_r2_media_metadata.sql`。
- 迁移准备：`scripts/migrate-assets-to-r2.mjs`、`package.json`、`.gitignore`。
- 配置示例与依赖：`.env.example`、`package.json`、`package-lock.json`。

## C. 新架构

`浏览器 -> /api/r2/upload-url（仅签名和校验） -> R2 PUT（文件本体） -> 应用 API HEAD 校验 -> Supabase/清单只保存元数据`

- 签名有效期 15 分钟，key 由服务端生成，禁止 `..`、反斜杠和超长 key。
- S3 客户端使用 `@aws-sdk/client-s3`、`region: "auto"` 和 `R2_ENDPOINT`。
- 图片客户端读取宽高并生成 640px WebP 缩略图；图库优先用缩略图，原图详情按需读取。
- R2 完整配置后为主写入；缺少配置时回退旧存储，因此部署切换可分两步完成。
- 新清单优先写 R2；读取顺序为 R2 新清单，再回退 Vercel Blob 旧清单。

## D. Cloudflare / Vercel 手动操作

1. Cloudflare R2 创建 bucket。
2. 创建仅限该 bucket 的 Object Read & Write API token，保存 Access Key ID 与 Secret Access Key。
3. 为 bucket 配置 CORS（把域名替换为真实域名）：

```json
[
  {
    "AllowedOrigins": ["https://你的域名", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

4. 推荐给 bucket 绑定自定义域名，并把它填入 `R2_PUBLIC_BASE_URL`。
5. 在 Vercel Project Settings -> Environment Variables 填写六个 R2 变量；不要删除任何旧 Blob/Supabase 变量。
6. 在 Supabase SQL Editor 执行 `supabase/migrations/20260814_add_r2_media_metadata.sql`。
7. 重新部署。官方参考：<https://developers.cloudflare.com/r2/get-started/s3/>、<https://developers.cloudflare.com/r2/api/s3/presigned-urls/>、<https://developers.cloudflare.com/r2/buckets/cors/>。

## E. 验证 R2 上传

1. 登录 `/admin/uploads`，上传一张小图片。
2. 浏览器 Network 中应看到：先请求 `/api/r2/upload-url`，再直接 `PUT` 到 `r2.cloudflarestorage.com`；文件本体不应 POST 到 Vercel API。
3. PUT 返回 2xx；随后记录 API 返回成功。
4. Cloudflare R2 bucket 中应出现 `portfolio/admin/...` 原图和 `thumbnails/portfolio/admin/...webp`。
5. `/api/storage-health` 的 `primary_provider` 应为 `cloudflare-r2` 且 `write_check.writable=true`。
6. 刷新 `/database.html`：首批 24 项，点击“加载更多”分页；点击作品后才请求详情/原图。

## F. 回滚

1. 从 Vercel 删除或暂时清空 R2 环境变量并重新部署，上传会自动回退旧 Blob/Supabase 路径。
2. 不要删除 R2 bucket；已写入的 R2 URL 仍需继续读取。
3. 如需代码回滚，只回滚本报告 B 节文件和新增 AWS SDK 依赖；不要回滚数据库中的旧 URL。
4. 数据库新增列是可保留的无害增量，不需要删除。
5. 旧资产迁移脚本默认 dry-run，且不更新数据库、不删除源文件。真实执行前使用 `npm run migrate:r2` 检查日志；仅显式加入 `--execute` 才上传。

## 旧资产迁移脚本

```bash
# 默认 dry-run：扫描 public，不上传
npm run migrate:r2

# 真实复制（不会删除源文件，也不会改数据库）
node scripts/migrate-assets-to-r2.mjs --source public --execute --retries 3

# 从数据库/Blob 导出的 JSON 清单迁移
node scripts/migrate-assets-to-r2.mjs --manifest ./export.json --dry-run
```

脚本使用状态文件跳过已完成项，以 R2 HEAD + 大小检查跳过重复对象，JSONL 记录日志，失败自动重试并写入 `failed` 项。脚本不会自动启动全量迁移。

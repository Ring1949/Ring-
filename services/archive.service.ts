import { NextRequest } from "next/server";
import { getSettings, now, replaceTagLinks, setSettings, slugify } from "@/lib/db";
import { getSupabaseServer, SUPABASE_MEDIA_BUCKET } from "@/lib/supabase";
import { createR2PresignedUpload, deleteR2Object, r2Configured, verifyR2Object } from "@/lib/r2";
import { bool, formValue, isAdmin, json, parseTagIds, requireAdmin } from "@/lib/utils";
import { defaultCategories, isSupabaseConfigError } from "@/lib/fallback-data";

const toBool = (value: unknown) => bool(value) === 1;
const flag = (value: unknown) => value === true || value === 1 ? 1 : 0;

function normalizeProject(project: any) {
  if (!project) return project;
  const rawCategorySlug = project.categories?.slug || project.category_slug || "";
  const product = rawCategorySlug === "product" || String(project.slug || "").startsWith("product-");
  return {
    ...project,
    is_featured: flag(project.is_featured),
    is_recommended: flag(project.is_recommended),
    is_series: flag(project.is_series),
    ...(product ? { collection_slug: "product" } : {}),
    category_id: rawCategorySlug === "product" ? 1 : project.category_id,
    category_name: rawCategorySlug === "product" ? "摄影" : project.categories?.name || project.category_name || "",
    category_slug: rawCategorySlug === "product" ? "photo" : rawCategorySlug
  };
}

function normalizeMedia(media: any) {
  if (!media) return media;
  const { show_in_inspiration: _removedChannelFlag, ...cleanMedia } = media;
  const rawCategorySlug = media.categories?.slug || media.category_slug || "";
  const projectSlug = media.projects?.slug || media.project_slug || "";
  const product = rawCategorySlug === "product" || String(projectSlug).startsWith("product-");
  return {
    ...cleanMedia,
    is_hero: flag(media.is_hero),
    is_selected: flag(media.is_selected),
    is_cover: flag(media.is_cover),
    show_in_database: flag(media.show_in_database),
    project_title: media.projects?.title || media.project_title || "",
    project_slug: media.projects?.slug || media.project_slug || "",
    project_year: media.projects?.year || media.project_year || "",
    project_location: media.projects?.location || media.project_location || "",
    ...(product ? { collection_slug: "product" } : {}),
    category_id: rawCategorySlug === "product" ? 1 : media.category_id,
    category_name: rawCategorySlug === "product" ? "摄影" : media.categories?.name || media.category_name || "",
    category_slug: rawCategorySlug === "product" ? "photo" : rawCategorySlug
  };
}

function normalizeCategory(category: any, projectCount = 0) {
  return { ...category, is_primary: flag(category.is_primary), project_count: projectCount };
}

async function canonicalCategoryId(value: unknown) {
  const categoryId = Number(value) || null;
  if (!categoryId) return null;
  const supabase = getSupabaseServer();
  const selected = await supabase.from("categories").select("id,slug").eq("id", categoryId).maybeSingle();
  if (selected.error) throw selected.error;
  if (selected.data?.slug !== "product") return categoryId;
  const photo = await supabase.from("categories").select("id").eq("slug", "photo").maybeSingle();
  if (photo.error) throw photo.error;
  if (!photo.data) throw new Error("摄影分类不存在，请先在作品管理中创建摄影分类。");
  return Number(photo.data.id);
}

function extensionFor(filename: string) {
  const clean = filename.split("?")[0];
  const index = clean.lastIndexOf(".");
  return index >= 0 ? clean.slice(index + 1).toLowerCase() : "";
}

function mimeTypeForExtension(extension: string) {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    pdf: "application/pdf",
    zip: "application/zip"
  };
  return map[extension] || "application/octet-stream";
}
function inferMediaTypeFromMime(mimeType = "", filename = "") {
  const extension = extensionFor(filename);
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension)) return "image";
  if (["mp4", "mov", "m4v", "webm", "avi", "mkv", "mpeg", "mpg"].includes(extension)) return "video";
  return "file";
}

async function verifyStorageObject(storagePath: string, expectedSize = 0, storageProvider = "supabase") {
  if (!storagePath) throw new Error("Upload verification failed: empty storage path.");
  if (storageProvider === "r2") {
    await verifyR2Object(storagePath, expectedSize);
    return;
  }
  const slash = storagePath.lastIndexOf("/");
  const folder = slash >= 0 ? storagePath.slice(0, slash) : "";
  const name = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;
  const { data, error } = await getSupabaseServer().storage.from(SUPABASE_MEDIA_BUCKET).list(folder || undefined, { search: name, limit: 20 });
  if (error) throw new Error(`Upload verification failed: ${error.message}`);
  const item = (data || []).find((entry: any) => entry.name === name);
  if (!item) throw new Error("Upload verification failed: file is missing from Storage.");
  const storedSize = Number((item as any).metadata?.size || 0);
  if (expectedSize > 0 && storedSize > 0 && storedSize !== expectedSize) throw new Error("Upload verification failed: stored file size does not match the uploaded file.");
}

async function uploadToStorage(file: File | null) {
  if (!file || !file.size) return null;
  throw new Error("服务端文件上传已停用，请使用浏览器直传 Cloudflare R2。");
}
async function createSignedStorageUpload(filename: string, contentType = "", size = 0, origin = "") {
  if (!r2Configured()) throw new Error("Cloudflare R2 未配置，新文件无法上传。");
  const signed = await createR2PresignedUpload({ kind: "legacy-media", filename, contentType, size, origin });
  return {
    ...signed,
    filename: signed.object_key.split("/").pop() || signed.object_key,
    originalname: filename,
    mimetype: signed.content_type,
    size,
    storage_provider: "r2",
    object_key: signed.object_key
  };
}

function mediaPayloadFromSaved(saved: any, values: any, index = 0) {
  const mediaType = inferMediaTypeFromMime(saved.mimetype, saved.originalname);
  return {
    project_id: values.project_id ? Number(values.project_id) : null,
    category_id: values.category_id ? Number(values.category_id) : null,
    title: values.title || saved.originalname,
    description: values.description || "",
    file_path: saved.public_url,
    storage_path: saved.storage_path || "",
    object_key: saved.object_key || saved.storage_path || "",
    storage_provider: saved.storage_provider || "supabase",
    original_name: saved.originalname,
    file_type: extensionFor(saved.originalname),
    mime_type: saved.mimetype,
    size: Number(saved.size) || 0,
    width: Number(saved.width) || 0,
    height: Number(saved.height) || 0,
    media_type: mediaType,
    tags: values.tags || "",
    camera: values.camera || "",
    lens: values.lens || "",
    aperture: values.aperture || "",
    shutter_speed: values.shutter_speed || "",
    iso: values.iso || "",
    captured_at: values.captured_at || "",
    is_hero: index === 0 ? toBool(values.is_hero) : false,
    is_selected: toBool(values.is_selected),
    is_cover: mediaType === "image" ? toBool(values.is_cover) : false,
    show_in_database: toBool(values.show_in_database),
    sort_order: (Number(values.sort_order) || 0) + index,
    created_at: now(),
    updated_at: now()
  };
}

function storagePathFromPublicUrl(url: string) {
  if (!url) return "";
  const marker = `/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return "";
  return decodeURIComponent(url.slice(index + marker.length));
}

async function removeStorageUrl(url: string) {
  const storagePath = storagePathFromPublicUrl(url);
  if (!storagePath) return;
  await getSupabaseServer().storage.from(SUPABASE_MEDIA_BUCKET).remove([storagePath]);
}

async function removeMediaObject(item: any) {
  const storagePath = String(item?.object_key || item?.storage_path || "");
  const r2 = item?.storage_provider === "r2" || String(item?.file_path || "").includes("/api/r2/object/");
  if (r2 && storagePath) {
    await deleteR2Object(storagePath);
    return;
  }
  await removeStorageUrl(String(item?.file_path || ""));
}

async function addMediaTagIds(mediaRows: any[]) {
  const rows = mediaRows || [];
  if (!rows.length) return rows.map(normalizeMedia);
  const ids = rows.map((row) => row.id).filter(Boolean);
  const { data, error } = await getSupabaseServer().from("media_tags").select("media_id,tag_id").in("media_id", ids);
  if (error) throw error;
  const map = new Map<number, number[]>();
  (data || []).forEach((link: any) => {
    if (!map.has(link.media_id)) map.set(link.media_id, []);
    map.get(link.media_id)?.push(link.tag_id);
  });
  return rows.map((row) => normalizeMedia({ ...row, tag_ids: (map.get(row.id) || []).join(",") }));
}

async function projectWithRelations(project: any) {
  if (!project) return null;
  const supabase = getSupabaseServer();
  const [tagsResult, mediaResult, categoryResult] = await Promise.all([
    supabase.from("project_tags").select("tag_id").eq("project_id", project.id),
    supabase.from("media").select("*").eq("project_id", project.id).order("sort_order", { ascending: true }).order("id", { ascending: true }),
    project.category_id ? supabase.from("categories").select("*").eq("id", project.category_id).maybeSingle() : Promise.resolve({ data: null, error: null }) as any
  ]);
  if (tagsResult.error) throw tagsResult.error;
  if (mediaResult.error) throw mediaResult.error;
  if (categoryResult.error) throw categoryResult.error;
  let tags: any[] = [];
  const tagIds = (tagsResult.data || []).map((row: any) => row.tag_id);
  if (tagIds.length) {
    const tagResult = await supabase.from("tags").select("*").in("id", tagIds).order("name", { ascending: true });
    if (tagResult.error) throw tagResult.error;
    tags = tagResult.data || [];
  }
  return {
    ...normalizeProject(project),
    tags,
    media: (mediaResult.data || []).map(normalizeMedia),
    category: categoryResult.data
  };
}

async function createMediaBatch(payloads: Record<string, unknown>[], tagIds: unknown[] = []) {
  if (!payloads.length) return [];
  const supabase = getSupabaseServer();
  let { data, error } = await supabase.from("media").insert(payloads).select("*");
  if (error && /column .* (object_key|storage_provider|width|height).* does not exist|schema cache/i.test(error.message || "")) {
    const legacyPayloads = payloads.map(({ object_key: _objectKey, storage_provider: _storageProvider, width: _width, height: _height, ...payload }) => payload);
    ({ data, error } = await supabase.from("media").insert(legacyPayloads).select("*"));
  }
  if (error) {
    const r2Paths = payloads.filter((payload: any) => payload.storage_provider === "r2").map((payload: any) => String(payload.storage_path || "")).filter(Boolean);
    const supabasePaths = payloads.filter((payload: any) => payload.storage_provider !== "r2").map((payload: any) => String(payload.storage_path || "")).filter(Boolean);
    await Promise.all(r2Paths.map((key) => deleteR2Object(key).catch(() => undefined)));
    if (supabasePaths.length) await supabase.storage.from(SUPABASE_MEDIA_BUCKET).remove(supabasePaths).catch(() => undefined as any);
    throw new Error(`Upload failed: ${error.message}. Confirm the public Storage bucket "${SUPABASE_MEDIA_BUCKET}" exists and check the file size and format.`);
  }

  const normalized = (data || []).map(normalizeMedia);
  const tags = parseTagIds(tagIds).map(Number).filter(Boolean);
  if (tags.length && normalized.length) {
    const links = normalized.flatMap((media: any) => tags.map((tagId: number) => ({ media_id: media.id, tag_id: tagId })));
    const { error: tagError } = await supabase.from("media_tags").insert(links);
    if (tagError) throw new Error(`Media tag save failed: ${tagError.message}`);
  }

  const hero = normalized.find((media: any) => media.is_hero);
  if (hero) await syncHero(hero);
  return normalized;
}

async function syncHero(media: any) {
  if (!media?.is_hero) return;
  const supabase = getSupabaseServer();
  await supabase.from("media").update({ is_hero: false, updated_at: now() }).neq("id", media.id);
  await setSettings({ hero_media: media.file_path, hero_media_type: media.media_type });
}

async function handleArchiveGetCore(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  const search = request.nextUrl.searchParams;

  // Session validation is independent of Supabase and must stay available when the data service is unavailable.
  if (route === "me") return json({ authenticated: isAdmin(request) });

  if (route === "settings") return json(await getSettings());
  const supabase = getSupabaseServer();

  if (route === "categories") {
    const includeAll = search.get("all") === "true" && isAdmin(request);
    let query = supabase.from("categories").select("*").order("sort_order", { ascending: true }).order("id", { ascending: true });
    if (!includeAll) query = query.eq("is_primary", true);
    const { data, error } = await query;
    if (error) throw error;
    const categories = await Promise.all((data || []).map(async (category: any) => {
      const { count, error: countError } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("category_id", category.id)
        .eq("status", "published");
      if (countError) throw countError;
      return normalizeCategory(category, count || 0);
    }));
    const product = categories.find((category: any) => category.slug === "product");
    return json(categories
      .filter((category: any) => category.slug !== "product")
      .map((category: any) => category.slug === "photo"
        ? {
            ...category,
            name: "摄影",
            description: "人物、现场、城市、产品与观看方式。",
            project_count: Number(category.project_count || 0) + Number(product?.project_count || 0)
          }
        : category));
  }

  if (route === "tags") {
    const { data, error } = await supabase.from("tags").select("*").order("name", { ascending: true });
    if (error) throw error;
    return json(data || []);
  }

  if (route === "series") {
    const { data, error } = await supabase
      .from("projects")
      .select("*, categories:category_id(name,slug)")
      .eq("is_series", true)
      .order("is_recommended", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    const projects = await Promise.all((data || []).map(async (project: any) => {
      let cover = project.cover_image;
      let mediaType = "image";
      if (!cover) {
        const media = await supabase
          .from("media")
          .select("file_path,media_type")
          .eq("project_id", project.id)
          .in("media_type", ["image", "video"])
          .order("is_cover", { ascending: false })
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (media.error) throw media.error;
        cover = media.data?.file_path || "";
        mediaType = media.data?.media_type || "image";
      }
      return { ...normalizeProject(project), series_cover: cover, series_media_type: mediaType };
    }));
    return json(projects);
  }


  if (route === "projects") {
    let query = supabase.from("projects").select("*, categories:category_id(name,slug)");
    if (search.get("category_id")) query = query.eq("category_id", Number(search.get("category_id")));
    if (search.get("featured") === "true") query = query.eq("is_featured", true);
    if (search.get("recommended") === "true") query = query.eq("is_recommended", true);
    if (search.get("status")) query = query.eq("status", search.get("status"));
    else if (!isAdmin(request)) query = query.eq("status", "published");
    const { data, error } = await query.order("sort_order", { ascending: true }).order("id", { ascending: true });
    if (error) throw error;
    return json((data || []).map(normalizeProject));
  }

  if (path[0] === "projects" && path[1]) {
    const { data, error } = await supabase
      .from("projects")
      .select("*, categories:category_id(name,slug)")
      .eq("id", Number(path[1]))
      .maybeSingle();
    if (error) throw error;
    const project = await projectWithRelations(data);
    if (!project || (!isAdmin(request) && project.status !== "published")) return json({ error: "Resource not found" }, 404);
    const related = await supabase
      .from("projects")
      .select("id,title,subtitle,cover_image,year")
      .eq("category_id", project.category_id)
      .neq("id", project.id)
      .eq("status", "published")
      .eq("is_series", toBool(project.is_series))
      .order("is_recommended", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(4);
    if (related.error) throw related.error;
    return json({ ...project, related: related.data || [] });
  }

  if (route === "media") {
    let query = supabase.from("media").select("*, projects:project_id(title,slug,year,location), categories:category_id(name,slug)");
    ["project_id", "category_id"].forEach((key) => {
      if (search.get(key)) query = query.eq(key, Number(search.get(key)));
    });
    if (search.get("selected") === "true") query = query.eq("is_selected", true);
    if (search.get("hero") === "true") query = query.eq("is_hero", true);
    if (search.get("database") === "true") query = query.eq("show_in_database", true);
    if (search.get("category")) {
      const slug = search.get("category") === "3d" ? "three-d" : search.get("category");
      const slugs = slug === "photo" ? ["photo", "product"] : [slug];
      const categories = await supabase.from("categories").select("id").in("slug", slugs);
      if (categories.error) throw categories.error;
      const categoryIds = (categories.data || []).map((item: any) => item.id);
      if (!categoryIds.length) return json([]);
      query = query.in("category_id", categoryIds);
    }
    const { data, error } = await query.order("sort_order", { ascending: true }).order("id", { ascending: true });
    if (error) throw error;
    return json(await addMediaTagIds(data || []));
  }

  if (path[0] === "media" && path[1]) {
    const { data, error } = await supabase
      .from("media")
      .select("*, projects:project_id(title,slug,year,location), categories:category_id(name,slug)")
      .eq("id", Number(path[1]))
      .maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Resource not found" }, 404);
    const [media] = await addMediaTagIds([data]);
    return json(media);
  }

  return json({ error: "Not found" }, 404);
}


export async function handleArchiveGet(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    return await handleArchiveGetCore(request, context);
  } catch (error) {
    const { path } = await context.params;
    const route = path.join("/");
    if (isSupabaseConfigError(error)) {
      if (route === "settings") return json(await getSettings());
      if (route === "categories") return json(defaultCategories);
      if (["projects", "media", "tags", "series"].includes(route)) return json([]);
      if (path[0] === "projects") return json({ error: "Resource not found" }, 404);
      if (path[0] === "media") return json({ error: "Resource not found" }, 404);
    }
    const message = error instanceof Error ? error.message : String(error || "Request failed");
    return json({ error: message }, 500);
  }
}
export async function handleArchivePost(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");

  if (route === "login") {
    const body = await request.json().catch(() => ({}));
    if (String(body.password || "") !== String(process.env.ADMIN_PASSWORD || "1234")) return json({ error: "Invalid password" }, 401);
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
  const supabase = getSupabaseServer();

  if (route === "categories") {
    const form = await request.formData();
    const file = await uploadToStorage(form.get("cover") as File | null);
    const categorySlug = slugify(formValue(form,"slug") || formValue(form,"name"));
    if (categorySlug === "product") return json({ error: "产品摄影已经并入摄影，请直接使用摄影分类。" }, 409);
    const payload = {
      name: formValue(form,"name"),
      slug: categorySlug,
      description: formValue(form,"description"),
      cover_image: file?.public_url || "",
      sort_order: Number(formValue(form,"sort_order")) || 0,
      created_at: now(),
      updated_at: now()
    };
    const { data, error } = await supabase.from("categories").insert(payload).select("*").single();
    if (error) throw error;
    return json(normalizeCategory(data), 201);
  }

  if (route === "tags") {
    const contentType = request.headers.get("content-type") || "";
    const body: any = contentType.includes("application/json")
      ? await request.json().catch(() => ({}))
      : Object.fromEntries((await request.formData()).entries());
    const name = String(body.name || "").trim();
    if (!name) return json({ error: "Bad request" }, 400);
    const { data, error } = await supabase.from("tags").insert({ name, slug: slugify(body.slug || name), created_at: now() }).select("*").single();
    if (error) throw error;
    return json(data, 201);
  }

  if (route === "projects") {
    const form = await request.formData();
    const file = await uploadToStorage(form.get("cover") as File | null);
    const payload = {
      title: formValue(form,"title"),
      subtitle: formValue(form,"subtitle"),
      slug: slugify(formValue(form,"slug") || formValue(form,"title")),
      category_id: await canonicalCategoryId(formValue(form,"category_id")),
      description: formValue(form,"description"),
      cover_image: file?.public_url || "",
      year: formValue(form,"year"),
      location: formValue(form,"location"),
      tags: formValue(form,"tags"),
      is_featured: toBool(form.get("is_featured")),
      is_recommended: toBool(form.get("is_recommended")),
      is_series: toBool(form.get("is_series")),
      status: formValue(form,"status") === "published" ? "published" : "draft",
      sort_order: Number(formValue(form,"sort_order")) || 0,
      created_at: now(),
      updated_at: now()
    };
    const { data, error } = await supabase.from("projects").insert(payload).select("*").single();
    if (error) throw error;
    await replaceTagLinks("project_tags", "project_id", data.id, parseTagIds(formValue(form,"tag_ids","[]")));
    return json(await projectWithRelations(data), 201);
  }

  if (route === "media/upload-sign") {
    const body: any = await request.json().catch(() => ({}));
    const filename = String(body.filename || "").trim();
    if (!filename) return json({ error: "Missing filename" }, 400);
    return json(await createSignedStorageUpload(filename, String(body.contentType || ""), Number(body.size) || 0, request.nextUrl.origin));
  }

  if (route === "media/direct-record") {
    const body: any = await request.json().catch(() => ({}));
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) return json({ error: "No uploaded files" }, 400);
    await Promise.all(files.map((file: any) => verifyStorageObject(String(file.storage_path || ""), Number(file.size) || 0, String(file.storage_provider || "supabase"))));
    const values = { ...body, category_id: await canonicalCategoryId(body.category_id) };
    const payloads = files.map((file: any, index: number) => mediaPayloadFromSaved(file, values, index));
    const created = await createMediaBatch(payloads, parseTagIds(body.tag_ids));
    return json(created, 201);
  }
  if (route === "media/upload") {
    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    if (!files.length) return json({ error: "Bad request" }, 400);
    const values = Object.fromEntries(form.entries());
    values.category_id = await canonicalCategoryId(values.category_id) as any;
    const savedFiles = await Promise.all(files.map((file) => uploadToStorage(file)));
    const payloads = savedFiles.filter(Boolean).map((saved, index) => mediaPayloadFromSaved(saved, values, index));
    const created = await createMediaBatch(payloads, parseTagIds(formValue(form,"tag_ids","[]")));
    return json(created, 201);
  }

  return json({ error: "Not found" }, 404);
}

export async function handleArchivePut(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const denied = requireAdmin(request);
  if (denied) return denied;

  if (path[0] === "settings") {
    const body = await request.json().catch(() => ({}));
    return json(await setSettings(body || {}));
  }

  const supabase = getSupabaseServer();

  if (path[0] === "categories" && path[1]) {
    const existing = await supabase.from("categories").select("*").eq("id", Number(path[1])).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return json({ error: "Resource not found" }, 404);
    const form = await request.formData();
    const file = await uploadToStorage(form.get("cover") as File | null);
    if (file) await removeStorageUrl(existing.data.cover_image);
    const categorySlug = slugify(formValue(form,"slug",existing.data.slug));
    if (categorySlug === "product") return json({ error: "产品摄影已经并入摄影，请直接使用摄影分类。" }, 409);
    const payload = {
      name: formValue(form,"name",existing.data.name),
      slug: categorySlug,
      description: formValue(form,"description",existing.data.description),
      cover_image: file?.public_url || formValue(form,"cover_image", existing.data.cover_image),
      sort_order: Number(formValue(form,"sort_order",String(existing.data.sort_order))) || 0,
      updated_at: now()
    };
    const { data, error } = await supabase.from("categories").update(payload).eq("id", Number(path[1])).select("*").single();
    if (error) throw error;
    return json(normalizeCategory(data));
  }

  if (path[0] === "projects" && path[1]) {
    const existing = await supabase.from("projects").select("*").eq("id", Number(path[1])).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return json({ error: "Resource not found" }, 404);
    const form = await request.formData();
    const file = await uploadToStorage(form.get("cover") as File | null);
    if (file) await removeStorageUrl(existing.data.cover_image);
    const payload = {
      title: formValue(form,"title",existing.data.title),
      subtitle: formValue(form,"subtitle",existing.data.subtitle),
      slug: slugify(formValue(form,"slug",existing.data.slug)),
      category_id: await canonicalCategoryId(formValue(form,"category_id")),
      description: formValue(form,"description",existing.data.description),
      cover_image: file?.public_url || formValue(form,"cover_image", existing.data.cover_image),
      year: formValue(form,"year",existing.data.year),
      location: formValue(form,"location",existing.data.location),
      tags: formValue(form,"tags",existing.data.tags),
      is_featured: toBool(form.get("is_featured")),
      is_recommended: toBool(form.get("is_recommended")),
      is_series: form.get("is_series") === null ? existing.data.is_series : toBool(form.get("is_series")),
      status: formValue(form,"status") === "published" ? "published" : "draft",
      sort_order: Number(formValue(form,"sort_order",String(existing.data.sort_order))) || 0,
      updated_at: now()
    };
    const { data, error } = await supabase.from("projects").update(payload).eq("id", Number(path[1])).select("*").single();
    if (error) throw error;
    if (form.get("tag_ids") !== null) await replaceTagLinks("project_tags", "project_id", Number(path[1]), parseTagIds(formValue(form,"tag_ids","[]")));
    return json(await projectWithRelations(data));
  }

  if (path[0] === "media" && path[1]) {
    const existing = await supabase.from("media").select("*").eq("id", Number(path[1])).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return json({ error: "Resource not found" }, 404);
    const body = await request.json();
    const payload = {
      project_id: body.project_id ? Number(body.project_id) : null,
      category_id: await canonicalCategoryId(body.category_id),
      title: body.title ?? existing.data.title,
      description: body.description ?? existing.data.description,
      tags: body.tags ?? existing.data.tags,
      camera: body.camera ?? existing.data.camera,
      lens: body.lens ?? existing.data.lens,
      aperture: body.aperture ?? existing.data.aperture,
      shutter_speed: body.shutter_speed ?? existing.data.shutter_speed,
      iso: body.iso ?? existing.data.iso,
      captured_at: body.captured_at ?? existing.data.captured_at,
      is_hero: toBool(body.is_hero),
      is_selected: toBool(body.is_selected),
      is_cover: toBool(body.is_cover),
      show_in_database: toBool(body.show_in_database),
      sort_order: Number(body.sort_order ?? existing.data.sort_order),
      updated_at: now()
    };
    const { data, error } = await supabase.from("media").update(payload).eq("id", Number(path[1])).select("*").single();
    if (error) throw error;
    if (body.tag_ids !== undefined) await replaceTagLinks("media_tags", "media_id", Number(path[1]), parseTagIds(body.tag_ids));
    await syncHero(data);
    return json(normalizeMedia(data));
  }

  return json({ error: "Not found" }, 404);
}

export async function handleArchiveDelete(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const supabase = getSupabaseServer();
  const { path } = await context.params;
  const denied = requireAdmin(request);
  if (denied) return denied;

  if (path[0] === "tags" && path[1]) {
    const { error } = await supabase.from("tags").delete().eq("id", Number(path[1]));
    if (error) throw error;
    return json({ deleted: true });
  }
  if (path[0] === "categories" && path[1]) {
    const existing = await supabase.from("categories").select("*").eq("id", Number(path[1])).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return json({ error: "Resource not found" }, 404);
    await removeStorageUrl(existing.data.cover_image);
    const { error } = await supabase.from("categories").delete().eq("id", Number(path[1]));
    if (error) throw error;
    return json({ deleted: true });
  }
  if (path[0] === "projects" && path[1]) {
    const existing = await supabase.from("projects").select("*").eq("id", Number(path[1])).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return json({ error: "Resource not found" }, 404);
    const media = await supabase.from("media").select("*").eq("project_id", Number(path[1]));
    if (media.error) throw media.error;
    const { data: deleted, error } = await supabase.from("projects").delete().eq("id", Number(path[1])).select("id");
    if (error) throw error;
    if (!deleted?.length) return json({ error: "Resource not found" }, 404);

    // Deleting a series must not be blocked by a suspended or temporarily unavailable
    // object store. The database record is authoritative; file cleanup is best effort.
    const cleanup = await Promise.allSettled([
      removeStorageUrl(existing.data.cover_image),
      ...(media.data || []).map((item: any) => removeMediaObject(item))
    ]);
    const cleanupWarnings = cleanup.filter((result) => result.status === "rejected").length;
    return json({ deleted: true, cleanup_warnings: cleanupWarnings });
  }
  if (path[0] === "media" && path[1]) {
    const existing = await supabase.from("media").select("*").eq("id", Number(path[1])).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return json({ error: "Resource not found" }, 404);
    await removeMediaObject(existing.data);
    const { error } = await supabase.from("media").delete().eq("id", Number(path[1]));
    if (error) throw error;
    return json({ deleted: true });
  }
  return json({ error: "Not found" }, 404);
}



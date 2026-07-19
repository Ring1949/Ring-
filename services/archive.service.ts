import { NextRequest } from "next/server";
import { getSettings, now, replaceTagLinks, setSettings, slugify } from "@/lib/db";
import { getSupabaseServer, SUPABASE_MEDIA_BUCKET } from "@/lib/supabase";
import { bool, formValue, isAdmin, json, parseTagIds, requireAdmin } from "@/lib/utils";
import { defaultCategories, isSupabaseConfigError } from "@/lib/fallback-data";
import { parseInspirationResourceMap, parseInspirationTree } from "@/lib/inspiration";

const toBool = (value: unknown) => bool(value) === 1;
const flag = (value: unknown) => value === true || value === 1 ? 1 : 0;

function normalizeProject(project: any) {
  if (!project) return project;
  return {
    ...project,
    is_featured: flag(project.is_featured),
    is_recommended: flag(project.is_recommended),
    is_series: flag(project.is_series),
    category_name: project.categories?.name || project.category_name || "",
    category_slug: project.categories?.slug || project.category_slug || ""
  };
}

function normalizeMedia(media: any) {
  if (!media) return media;
  return {
    ...media,
    is_hero: flag(media.is_hero),
    is_selected: flag(media.is_selected),
    is_cover: flag(media.is_cover),
    show_in_database: flag(media.show_in_database),
    show_in_inspiration: flag(media.show_in_inspiration),
    project_title: media.projects?.title || media.project_title || "",
    project_slug: media.projects?.slug || media.project_slug || "",
    project_year: media.projects?.year || media.project_year || "",
    project_location: media.projects?.location || media.project_location || "",
    category_name: media.categories?.name || media.category_name || "",
    category_slug: media.categories?.slug || media.category_slug || ""
  };
}

function normalizeCategory(category: any, projectCount = 0) {
  return { ...category, is_primary: flag(category.is_primary), project_count: projectCount };
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

async function uploadToStorage(file: File | null) {
  if (!file || !file.size) return null;
  const supabase = getSupabaseServer();
  const extension = extensionFor(file.name);
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
  const { error } = await supabase.storage
    .from(SUPABASE_MEDIA_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || mimeTypeForExtension(extension),
      upsert: false
    });
  if (error) throw new Error(`Upload failed: ${error.message}. Confirm the public Storage bucket "${SUPABASE_MEDIA_BUCKET}" exists and check the file size and format.`);
  const { data } = supabase.storage.from(SUPABASE_MEDIA_BUCKET).getPublicUrl(storagePath);
  return {
    filename: storagePath.split("/").pop() || storagePath,
    storage_path: storagePath,
    public_url: data.publicUrl,
    originalname: file.name,
    mimetype: file.type || mimeTypeForExtension(extension),
    size: file.size,
    metadata: {}
  };
}
async function createSignedStorageUpload(filename: string, contentType = "", size = 0) {
  const supabase = getSupabaseServer();
  const extension = extensionFor(filename);
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
  const signed = await supabase.storage
    .from(SUPABASE_MEDIA_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (signed.error) throw new Error(`Upload preparation failed: ${signed.error.message}. Confirm the public Storage bucket "${SUPABASE_MEDIA_BUCKET}" exists.`);
  const { data } = supabase.storage.from(SUPABASE_MEDIA_BUCKET).getPublicUrl(storagePath);
  return {
    filename: storagePath.split("/").pop() || storagePath,
    storage_path: storagePath,
    public_url: data.publicUrl,
    originalname: filename,
    mimetype: contentType || mimeTypeForExtension(extension),
    size,
    signed_url: signed.data.signedUrl,
    token: signed.data.token,
    upload_headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
      "x-upsert": "false"
    }
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
    original_name: saved.originalname,
    file_type: extensionFor(saved.originalname),
    mime_type: saved.mimetype,
    size: Number(saved.size) || 0,
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
    show_in_inspiration: toBool(values.show_in_inspiration),
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
  const { data, error } = await supabase.from("media").insert(payloads).select("*");
  if (error) throw new Error(`Upload failed: ${error.message}. Confirm the public Storage bucket "${SUPABASE_MEDIA_BUCKET}" exists and check the file size and format.`);

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
  if (route === "inspiration-config") {
    const settings = await getSettings();
    return json({
      tree: parseInspirationTree(settings.inspiration_tree_json),
      assignments: parseInspirationResourceMap(settings.inspiration_resource_map_json)
    });
  }
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
    return json(categories);
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

  if (route === "inspiration") {
    const { data, error } = await supabase
      .from("media")
      .select("*, categories:category_id(name,slug)")
      .eq("show_in_inspiration", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    return json((data || []).map(normalizeMedia));
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
      const category = await supabase.from("categories").select("id").eq("slug", slug).maybeSingle();
      if (category.error) throw category.error;
      if (!category.data) return json([]);
      query = query.eq("category_id", category.data.id);
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
      if (["projects", "media", "tags", "series", "inspiration"].includes(route)) return json([]);
      if (route === "inspiration-config") return json({ tree: parseInspirationTree(""), assignments: {} });
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
    const payload = {
      name: formValue(form,"name"),
      slug: slugify(formValue(form,"slug") || formValue(form,"name")),
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
      category_id: formValue(form,"category_id") ? Number(formValue(form,"category_id")) : null,
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
    return json(await createSignedStorageUpload(filename, String(body.contentType || ""), Number(body.size) || 0));
  }

  if (route === "media/direct-record") {
    const body: any = await request.json().catch(() => ({}));
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) return json({ error: "No uploaded files" }, 400);
    const payloads = files.map((file: any, index: number) => mediaPayloadFromSaved(file, body, index));
    return json(await createMediaBatch(payloads, parseTagIds(body.tag_ids)), 201);
  }
  if (route === "media/upload") {
    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    if (!files.length) return json({ error: "Bad request" }, 400);
    const values = Object.fromEntries(form.entries());
    const savedFiles = await Promise.all(files.map((file) => uploadToStorage(file)));
    const payloads = savedFiles.filter(Boolean).map((saved, index) => mediaPayloadFromSaved(saved, values, index));
    return json(await createMediaBatch(payloads, parseTagIds(formValue(form,"tag_ids","[]"))), 201);
  }

  return json({ error: "Not found" }, 404);
}

export async function handleArchivePut(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const denied = requireAdmin(request);
  if (denied) return denied;

  if (path[0] === "inspiration-config") {
    const body: any = await request.json().catch(() => ({}));
    const values: Record<string, string> = {};
    if (body.tree !== undefined) values.inspiration_tree_json = JSON.stringify(parseInspirationTree(body.tree));
    if (body.assignments !== undefined) values.inspiration_resource_map_json = JSON.stringify(parseInspirationResourceMap(body.assignments));
    await setSettings(values);
    return json({
      tree: body.tree !== undefined ? parseInspirationTree(body.tree) : undefined,
      assignments: body.assignments !== undefined ? parseInspirationResourceMap(body.assignments) : undefined
    });
  }

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
    const payload = {
      name: formValue(form,"name",existing.data.name),
      slug: slugify(formValue(form,"slug",existing.data.slug)),
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
      category_id: formValue(form,"category_id") ? Number(formValue(form,"category_id")) : null,
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
      category_id: body.category_id ? Number(body.category_id) : null,
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
      show_in_inspiration: body.show_in_inspiration === undefined ? existing.data.show_in_inspiration : toBool(body.show_in_inspiration),
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
    await removeStorageUrl(existing.data.cover_image);
    const media = await supabase.from("media").select("file_path").eq("project_id", Number(path[1]));
    if (media.error) throw media.error;
    await Promise.all((media.data || []).map((item: any) => removeStorageUrl(item.file_path)));
    const { error } = await supabase.from("projects").delete().eq("id", Number(path[1]));
    if (error) throw error;
    return json({ deleted: true });
  }
  if (path[0] === "media" && path[1]) {
    const existing = await supabase.from("media").select("*").eq("id", Number(path[1])).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return json({ error: "Resource not found" }, 404);
    await removeStorageUrl(existing.data.file_path);
    const { error } = await supabase.from("media").delete().eq("id", Number(path[1]));
    if (error) throw error;
    return json({ deleted: true });
  }
  return json({ error: "Not found" }, 404);
}
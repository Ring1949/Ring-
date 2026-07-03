import { createClient, SupabaseClient } from "@supabase/supabase-js";

let publicClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return url;
}

export function getSupabase(): SupabaseClient {
  if (publicClient) return publicClient;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  publicClient = createClient(getSupabaseUrl(), anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return publicClient;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. 后台上传图片/视频需要服务端 service role key，或需要在 Supabase Storage 为 anon 配置上传策略。");
  }
  serviceClient = createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return serviceClient;
}

export function getSupabaseServer(): SupabaseClient {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? getSupabaseAdmin() : getSupabase();
}

export const SUPABASE_MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "media";

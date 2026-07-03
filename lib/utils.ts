import { NextRequest, NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function bool(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "on" ? 1 : 0;
}

export function formValue(form: FormData, key: string, fallback = "") {
  const value = form.get(key);
  return typeof value === "string" ? value : fallback;
}

export function parseTagIds(value: unknown) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(String(value || "[]")); } catch { return []; }
}

export function isAdmin(request: NextRequest) {
  return request.cookies.get("sc_admin")?.value === "1";
}

export function requireAdmin(request: NextRequest) {
  return isAdmin(request) ? null : json({ error: "请先登录" }, 401);
}

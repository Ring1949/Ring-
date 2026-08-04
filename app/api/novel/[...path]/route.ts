import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const origin = process.env.NOVEL_API_ORIGIN?.replace(/\/$/, "");
  if (!origin) {
    return NextResponse.json(
      { message: "尚未设置 NOVEL_API_ORIGIN，请先连接小说工作流后端。" },
      { status: 503 }
    );
  }

  const { path } = await context.params;
  const url = `${origin}/api/${path.join("/")}${request.nextUrl.search}`;
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
  const authToken = process.env.NOVEL_API_AUTH_TOKEN?.trim();

  try {
    const upstreamHeaders = new Headers();
    upstreamHeaders.set("content-type", request.headers.get("content-type") ?? "application/json");
    if (authToken) upstreamHeaders.set("authorization", `Bearer ${authToken}`);
    const upstream = await fetch(url, {
      method: request.method,
      headers: upstreamHeaders,
      body,
      cache: "no-store",
    });

    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") ?? "application/json; charset=utf-8");
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers.set("content-disposition", disposition);
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json(
      { message: "无法连接到小说工作流后端。请检查 NOVEL_API_ORIGIN 与后端服务状态。" },
      { status: 502 }
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };

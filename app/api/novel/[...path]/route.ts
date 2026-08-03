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

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
      body,
      cache: "no-store",
    });

    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") ?? "application/json; charset=utf-8");
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json(
      { message: "无法连接到小说工作流后端。请检查 NOVEL_API_ORIGIN 与后端服务状态。" },
      { status: 502 }
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };

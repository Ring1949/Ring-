import fs from "node:fs";
import path from "node:path";

export function readLegacyBody(fileName: string) {
  const filePath = path.join(process.cwd(), "legacy", "html", fileName);
  const html = fs.readFileSync(filePath, "utf8");
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return body.replace(/<script\b[\s\S]*?<\/script>/gi, "").trim();
}

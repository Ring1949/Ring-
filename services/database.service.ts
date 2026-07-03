import { initDatabase } from "@/lib/db";

export function getDatabaseMedia(category: string | null) {
  const db = initDatabase();
  const clauses = ["media.show_in_database=1"];
  const params: string[] = [];
  if (category && category !== "all") {
    clauses.push("categories.slug=?");
    params.push(category === "3d" ? "three-d" : category);
  }
  return db.prepare(`
    SELECT media.*,projects.title AS project_title,projects.slug AS project_slug,
    categories.name AS category_name,categories.slug AS category_slug
    FROM media LEFT JOIN projects ON projects.id=media.project_id
    LEFT JOIN categories ON categories.id=media.category_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY media.sort_order,media.id
  `).all(...params);
}

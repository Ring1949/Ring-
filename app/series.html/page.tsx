import { LegacyPage } from "@/lib/LegacyPage";
import { basePortfolioCategories, basePortfolioProjects } from "@/lib/portfolio-state";

export default function Page() {
  const bootstrap = JSON.stringify({
    projects: basePortfolioProjects().filter((item: any) => item.is_series === 1 || item.is_series === true),
    categories: basePortfolioCategories()
  }).replace(/</g, "\\u003c");

  return (
    <>
      <LegacyPage
        html="series.html"
        styles={["/styles.css?v=20260624-1", "/series.css?v=20260624-1", "/site-nav.css?v=20260812-unified-1"]}
        scripts={["/common.js?v=20260812-unified-nav-1", "/series.js?v=20261031-fast-series-2"]}
      />
      <script id="series-bootstrap" type="application/json" dangerouslySetInnerHTML={{ __html: bootstrap }} />
    </>
  );
}

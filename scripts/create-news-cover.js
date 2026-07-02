const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "..", "制作网站素材图片", "01-原始作品库", "新闻上稿成果");
const output = path.join(root, "public", "assets", "news-series-cover.webp");
const sources = [
  "屏幕截图 2026-06-04 230946.png",
  "屏幕截图 2026-06-04 231111.png",
  "屏幕截图 2026-06-05 010634.png"
];

async function card(filename, width, height) {
  return sharp(path.join(sourceDir, filename))
    .resize(width, height, { fit: "cover", position: "top" })
    .png()
    .toBuffer();
}

async function main() {
  const [left, center, right] = await Promise.all([
    card(sources[0], 360, 650),
    card(sources[1], 500, 650),
    card(sources[2], 360, 650)
  ]);
  const title = Buffer.from(`
    <svg width="1600" height="1000">
      <style>
        .kicker{font:600 22px "Microsoft YaHei",sans-serif;letter-spacing:6px;fill:#aeb9bd}
        .title{font:600 82px "Microsoft YaHei",sans-serif;fill:#f4f1e8}
        .sub{font:400 24px "Microsoft YaHei",sans-serif;fill:#aeb9bd}
      </style>
      <text x="92" y="108" class="kicker">PUBLISHED WORK / 2026</text>
      <text x="92" y="206" class="title">新闻上稿成果</text>
      <text x="96" y="255" class="sub">摄影作品的媒体发布记录</text>
    </svg>
  `);
  await sharp({
    create: { width: 1600, height: 1000, channels: 3, background: "#20282c" }
  }).composite([
    { input: title, left: 0, top: 0 },
    { input: left, left: 92, top: 310 },
    { input: center, left: 550, top: 310 },
    { input: right, left: 1148, top: 310 }
  ]).webp({ quality: 88 }).toFile(output);
  console.log(output);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

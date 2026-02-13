// 呼び出した画面の動画をレンダリングしてmp4とgifにするjs。nodeで作成。要
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const { chromium } = require("playwright");

const args = process.argv.slice(2);
// ここは相対パスにしたほうがいいかも
const url = args[0] || "http://192.168.xx.xx:5500/public/preview.html";
const outputBase =
  args[1] ||
  path.resolve(__dirname, "..", "..", "public", "exports", "preview");
const durationSec = Number(args[2] || 30);
const width = Number(args[3] || 720);
const height = Number(args[4] || 1280);

const outputDir = path.dirname(outputBase);
fs.mkdirSync(outputDir, { recursive: true });

const run = (cmd, cmdArgs) => {
  const result = spawnSync(cmd, cmdArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${cmdArgs.join(" ")}`);
  }
};

const main = async () => {
  const tempDir = path.resolve(__dirname, ".tmp-video");
  fs.mkdirSync(tempDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: tempDir, size: { width, height } }
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(durationSec * 1000);
  const video = page.video();
  await context.close();
  await browser.close();

  const webmPath = await video.path();
  const mp4Path = `${outputBase}.mp4`;
  const gifPath = `${outputBase}.gif`;

  run("ffmpeg", [
    "-y",
    "-i",
    webmPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-vf",
    `scale=${width}:${height}`,
    mp4Path
  ]);

  run("ffmpeg", [
    "-y",
    "-i",
    webmPath,
    "-vf",
    `fps=15,scale=${width}:${height}:flags=lanczos`,
    gifPath
  ]);

  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log(`MP4: ${mp4Path}`);
  console.log(`GIF: ${gifPath}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

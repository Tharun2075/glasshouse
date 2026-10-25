// Build the 3D landing (separate Vite repo) for this app and copy it to public/landing, served at "/" by a rewrite in next.config.mjs.
// LANDING_DIR points at the glasshouse-landing checkout (default ~/Projects/glasshouse-landing).
import { execFileSync } from "node:child_process";
import { cpSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const src = resolve(process.env.LANDING_DIR ?? join(homedir(), "Projects/glasshouse-landing"));
if (!existsSync(join(src, "package.json"))) { console.error(`build:landing: no landing repo at ${src} (set LANDING_DIR)`); process.exit(1); }
const out = join(src, "dist-glasshouse");
execFileSync("npx", ["vite", "build", "--base=/landing/", "--outDir", out, "--emptyOutDir"], { cwd: src, stdio: "inherit" });
const dest = resolve("public/landing");
rmSync(dest, { recursive: true, force: true });
cpSync(out, dest, { recursive: true, filter: (f) => !/\.(br|gz)$/.test(f) });
// index.html is served at "/", so relative "./" and root "/img/" URLs must point into /landing/.
const html = join(dest, "index.html");
const site = (process.env.SITE_URL ?? "https://glasshouse-1a5k.onrender.com").replace(/\/$/, ""); // og:image must be an absolute URL
writeFileSync(html, readFileSync(html, "utf8").replace(/(["\s,])\.\//g, "$1/landing/").replace(/(["\s,])\/img\//g, "$1/landing/img/").replace(/content="(?:\/landing)?\/og\.png"/g, `content="${site}/og.png"`));
console.log(`build:landing: copied ${out} -> ${dest}`);

import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");

await mkdir(publicDir, { recursive: true });
await cp(path.join(root, "index.html"), path.join(publicDir, "index.html"));
await cp(path.join(root, "assets"), path.join(publicDir, "assets"), {
  recursive: true,
});

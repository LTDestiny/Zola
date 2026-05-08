import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.resolve(root, "../web/dist");
const target = path.resolve(root, "android/app/src/main/assets/public");

if (!fs.existsSync(source)) {
  throw new Error(`Missing web build output: ${source}`);
}
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Copied ${source} -> ${target}`);

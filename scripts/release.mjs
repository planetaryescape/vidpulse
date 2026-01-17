#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split(".").map(Number);
  switch (type) {
    case "major": return `${major + 1}.0.0`;
    case "minor": return `${major}.${minor + 1}.0`;
    default: return `${major}.${minor}.${patch + 1}`;
  }
}

// Parse args
const args = process.argv.slice(2);
let bumpType = "patch";
if (args.includes("--major")) bumpType = "major";
else if (args.includes("--minor")) bumpType = "minor";

// 1. Delete existing vidpulse-*.zip files
console.log("\n🗑️  Cleaning old bundles...");
for (const file of readdirSync(ROOT)) {
  if (file.startsWith("vidpulse-") && file.endsWith(".zip")) {
    unlinkSync(join(ROOT, file));
    console.log(`   Deleted ${file}`);
  }
}

// 2. Read manifest.json + package.json
const manifestPath = join(ROOT, "manifest.json");
const packagePath = join(ROOT, "package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

// 3. Bump version
const oldVersion = manifest.version;
const newVersion = bumpVersion(oldVersion, bumpType);
console.log(`\n📦 Version: ${oldVersion} → ${newVersion}`);

// 4. Write both files
manifest.version = newVersion;
pkg.version = newVersion;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

// 5. Run checks + build
console.log("\n🔍 Running checks...");
run("bun run typecheck");
run("bun run lint");
run("bun run build");

// 6. Zip dist/
const zipName = `vidpulse-v${newVersion}.zip`;
console.log(`\n📦 Creating ${zipName}...`);
run(`cd dist && zip -r ../${zipName} .`);

// 7. Done
console.log(`\n✅ Release bundle ready: ${zipName}`);

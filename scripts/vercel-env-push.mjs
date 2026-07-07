#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ENV_FILE = process.argv[2] ?? ".env";
const TARGETS = (process.argv[3] ?? "production,preview,development")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const raw = readFileSync(ENV_FILE, "utf8");

const vars = [];
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!key || value === "") continue;
  vars.push([key, value]);
}

if (vars.length === 0) {
  console.error(`Nenhuma variável válida encontrada em ${ENV_FILE}`);
  process.exit(1);
}

console.log(`Subindo ${vars.length} variáveis para: ${TARGETS.join(", ")}\n`);

for (const [key, value] of vars) {
  for (const target of TARGETS) {
    spawnSync("vercel", ["env", "rm", key, target, "-y"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    const res = spawnSync("vercel", ["env", "add", key, target], {
      input: value + "\n",
      stdio: ["pipe", "inherit", "inherit"],
    });
    if (res.status !== 0) {
      console.error(`FALHOU: ${key} (${target})`);
    } else {
      console.log(`OK: ${key} (${target})`);
    }
  }
}

console.log("\nPronto. Rode 'vercel --prod' para redeploy.");

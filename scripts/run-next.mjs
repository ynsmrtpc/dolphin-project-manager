// .env dosyasindaki PORT degerini okuyup `next <komut> -p <port>` calistirir.
// Boylece portu tek yerden (.env) yonetebiliyoruz.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const root = process.cwd();
const fileEnv = {
  ...readEnvFile(resolve(root, ".env")),
  ...readEnvFile(resolve(root, ".env.local")),
};

const port = process.env.PORT || fileEnv.PORT || "3000";
const command = process.argv[2] || "dev";
const extraArgs = process.argv.slice(3);

const nextBin = resolve(root, 'node_modules', 'next', 'dist', 'bin', 'next');

const child = spawn(process.execPath, [nextBin, command, '-p', String(port), ...extraArgs], {
  stdio: 'inherit',
  env: { ...fileEnv, ...process.env, PORT: String(port) },
});

child.on('exit', (code) => process.exit(code ?? 0));

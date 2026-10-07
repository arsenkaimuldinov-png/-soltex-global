/** Tiny `--name value` argument reader for the CLI scripts (no dependency). */
export function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : fallback;
  if (v === undefined) {
    console.error(`missing --${name}`);
    process.exit(2);
  }
  return v;
}

export function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`environment variable ${name} is not set (see .env.example)`);
    process.exit(2);
  }
  return v;
}

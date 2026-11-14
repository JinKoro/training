import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(here, '../../worker');
const state = path.resolve(here, '.state');
export const PORT = 8790;
const BASE = `http://localhost:${PORT}`;

let proc: ChildProcess | null = null;

async function waitUp(deadline: number) {
  while (Date.now() < deadline) {
    if (proc?.exitCode != null) throw new Error(`wrangler dev exited with ${proc.exitCode}`);
    try {
      const r = await fetch(`${BASE}/api/me`);
      if (r.status === 401) return;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('wrangler dev did not come up in time');
}

export async function setup() {
  rmSync(state, { recursive: true, force: true });
  execSync(`npx wrangler@4 d1 migrations apply training --local --persist-to ${JSON.stringify(state)}`, {
    cwd: workerDir, stdio: 'pipe', env: { ...process.env, CI: '1' },
  });
  let log = '';
  proc = spawn('npx', ['wrangler@4', 'dev', '--local', '--port', String(PORT), '--persist-to', state, '--show-interactive-dev-session=false'], {
    cwd: workerDir, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' }, detached: true,
  });
  proc.stdout?.on('data', (d) => { log += d; });
  proc.stderr?.on('data', (d) => { log += d; });
  try {
    await waitUp(Date.now() + 120_000);
  } catch (e) {
    console.error(log);
    await teardown();
    throw e;
  }
}

export async function teardown() {
  if (!proc || proc.pid == null) return;
  try { process.kill(-proc.pid, 'SIGTERM'); } catch { /* gone */ }
  await new Promise((r) => setTimeout(r, 500));
  try { process.kill(-proc.pid, 'SIGKILL'); } catch { /* gone */ }
  proc = null;
}

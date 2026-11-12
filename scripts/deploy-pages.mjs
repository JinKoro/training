// Publishes dist/ to the gh-pages branch (GitHub Pages serves it at jinkoro.github.io/training).
import { execSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const remote = execSync('git remote get-url origin').toString().trim();
const dir = mkdtempSync(join(tmpdir(), 'pages-'));
cpSync('dist', dir, { recursive: true });
writeFileSync(join(dir, '.nojekyll'), '');
run('git init -q -b gh-pages', dir);
run('git add -A', dir);
run('git -c user.name="Dmitriy Korotin" -c user.email="dskorotin@gmail.com" commit -q -m "Deploy"', dir);
run(`git -c credential.helper= -c "credential.helper=!gh auth git-credential" push -f ${remote} gh-pages`, dir);

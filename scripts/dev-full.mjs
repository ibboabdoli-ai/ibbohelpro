import { spawn } from 'child_process';

function start(cmd, args, name) {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('close', (code) => {
    console.log(`[${name}] exited with code ${code}`);
    process.exit(code || 0);
  });
  return child;
}

const api = start('npm', ['run', 'dev:api'], 'dev:api');
const web = start('npm', ['run', 'dev'], 'dev');

function shutdown() {
  api.kill('SIGTERM');
  web.kill('SIGTERM');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

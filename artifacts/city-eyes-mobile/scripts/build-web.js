const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

function normalizeDomain(rawDomain) {
  const value = rawDomain.trim();
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  return url.host;
}

const configuredDomain =
  process.env.REPLIT_INTERNAL_APP_DOMAIN ||
  process.env.REPLIT_DEV_DOMAIN ||
  process.env.EXPO_PUBLIC_DOMAIN;

if (!configuredDomain) {
  console.error(
    'ERROR: No app domain found. Set REPLIT_INTERNAL_APP_DOMAIN, REPLIT_DEV_DOMAIN, or EXPO_PUBLIC_DOMAIN.',
  );
  process.exit(1);
}

const env = {
  ...process.env,
  EXPO_PUBLIC_DOMAIN: normalizeDomain(configuredDomain),
};

const replId = process.env.REPL_ID || process.env.EXPO_PUBLIC_REPL_ID;
if (replId) {
  env.EXPO_PUBLIC_REPL_ID = replId;
}

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'expo',
    'export',
    '--platform',
    'web',
    '--output-dir',
    path.join(projectRoot, 'dist'),
  ],
  {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error('Web export could not start:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

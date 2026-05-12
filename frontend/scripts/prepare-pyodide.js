/**
 * prepare-pyodide.js  (Next.js / frontend version)
 *
 * Differences from the Svelte original:
 *  - Output directory is  frontend/public/pyodide  (served as /pyodide/*)
 *    instead of           static/pyodide
 *  - package.json is read from  frontend/package.json
 *
 * Run from the repo root:
 *   node --experimental-vm-modules frontend/scripts/prepare-pyodide.js
 * Or from inside frontend/:
 *   node scripts/prepare-pyodide.js
 */

const packages = [
  'micropip',
  'packaging',
  'requests',
  'beautifulsoup4',
  'numpy',
  'pandas',
  'matplotlib',
  'scikit-learn',
  'scipy',
  'regex',
  'sympy',
  'tiktoken',
  'seaborn',
  'pytz',
  'black',
  'openai',
];

import { loadPyodide } from 'pyodide';
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import { writeFile, readFile, copyFile, readdir, rmdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolve output relative to this script file so it works from any cwd.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = resolve(__dirname, '../public/pyodide');
const PACKAGE_JSON = resolve(__dirname, '../package.json');
const NODE_MODULES_PYODIDE = resolve(__dirname, '../node_modules/pyodide');

function initNetworkProxyFromEnv() {
  const allProxy = process.env.all_proxy || process.env.ALL_PROXY;
  const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY;
  const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY;
  const preferedProxy = httpsProxy || allProxy || httpProxy;

  if (!preferedProxy || !preferedProxy.startsWith('http')) return;
  let preferedProxyURL;
  try {
    preferedProxyURL = new URL(preferedProxy).toString();
  } catch {
    console.warn(`Invalid network proxy URL: "${preferedProxy}"`);
    return;
  }
  const dispatcher = new ProxyAgent({ uri: preferedProxyURL });
  setGlobalDispatcher(dispatcher);
  console.log(`Initialized network proxy "${preferedProxy}" from env`);
}

async function downloadPackages() {
  console.log('Setting up pyodide + micropip');
  console.log(`Output directory: ${OUTPUT_DIR}`);

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  let pyodide;
  try {
    pyodide = await loadPyodide({ packageCacheDir: OUTPUT_DIR });
  } catch (err) {
    console.error('Failed to load Pyodide:', err);
    return;
  }

  const packageJson = JSON.parse(await readFile(PACKAGE_JSON, 'utf-8'));
  const pyodideVersion = packageJson.dependencies?.pyodide?.replace('^', '');

  const lockPath = `${OUTPUT_DIR}/package.json`;
  try {
    const pyodidePackageJson = JSON.parse(await readFile(lockPath, 'utf-8'));
    const pyodidePackageVersion = pyodidePackageJson.version?.replace('^', '');

    if (pyodideVersion && pyodideVersion !== pyodidePackageVersion) {
      console.log('Pyodide version mismatch, removing output directory');
      await rmdir(OUTPUT_DIR, { recursive: true });
      await mkdir(OUTPUT_DIR, { recursive: true });
    }
  } catch {
    console.log('Pyodide package.json not found, proceeding with download.');
  }

  try {
    console.log('Loading micropip package');
    await pyodide.loadPackage('micropip');

    const micropip = pyodide.pyimport('micropip');
    console.log('Downloading Pyodide packages:', packages);

    try {
      for (const pkg of packages) {
        console.log(`Installing package: ${pkg}`);
        await micropip.install(pkg);
      }
    } catch (err) {
      console.error('Package installation failed:', err);
      return;
    }

    console.log('Pyodide packages downloaded, freezing into lock file');

    try {
      const lockFile = await micropip.freeze();
      await writeFile(`${OUTPUT_DIR}/pyodide-lock.json`, lockFile);
    } catch (err) {
      console.error('Failed to write lock file:', err);
    }
  } catch (err) {
    console.error('Failed to load or install micropip:', err);
  }
}

async function copyPyodide() {
  console.log(`Copying Pyodide files into ${OUTPUT_DIR}`);
  await mkdir(OUTPUT_DIR, { recursive: true });
  for await (const entry of await readdir(NODE_MODULES_PYODIDE)) {
    await copyFile(`${NODE_MODULES_PYODIDE}/${entry}`, `${OUTPUT_DIR}/${entry}`);
  }
}

initNetworkProxyFromEnv();
await downloadPackages();
await copyPyodide();

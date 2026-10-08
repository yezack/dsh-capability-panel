import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsdown';

// The client banner's module id MUST be the published package name: the host
// mounts a bundle by that name and then asks `__ModuleLoader__` for exactly it,
// so a hardcoded id silently breaks the entry the moment the package is renamed
// (as a scoped fork name does) — the bundle registers itself under the old id,
// the requested one never appears, and the boot reports "import failed" plus a
// duplicate factory registration. Read the manifest instead of repeating it.
const packageId = (JSON.parse(readFileSync('package.json', 'utf8')) as { name?: unknown }).name;
if (typeof packageId !== 'string' || packageId === '') {
  throw new Error('tsdown.config.ts: package.json has no name; run the build from the package root');
}

// DSH uses two different loaders: the host entry is a plain Node ESM module,
// while the browser entry must be a deferred CJS factory registered through
// `window.__ModuleLoader__`. Two separate configs keep an ordinary browser/ESM
// bundle from ever being mistaken for a DSH client module.
export default defineConfig([
  {
    name: packageId,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    dts: { sourcemap: true },
    sourcemap: true,
    clean: true,
    external: [
      /^@deepseek-ai\//,
      'react',
      'react-dom',
      /^react\//,
      /^react-dom\//,
    ],
  },
  {
    name: `${packageId}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    // react and ui-primitives must stay external: the __ModuleLoader__
    // factory's require resolves them to the host module graph's copies
    // (a bundled react is a second instance and hooks break; a bundled
    // primitives copy loses the host's theme and i18n context). Same for
    // dsh-client-store (createSnapshotStore must share the host's store
    // engine instance; it is one of the shell's platform modules).
    external: [
      'react',
      'react-dom',
      /^react\//,
      /^react-dom\//,
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-client-store',
    ],
    // Base UI leaves development guards as `process.env.NODE_ENV` checks.
    // DSH's browser module runtime does not provide Node's `process` global,
    // so replace them at build time instead of shipping a process shim.
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    sourcemap: true,
    // Both entries share the lib directory; cleaning here would delete the
    // lib/index.js the first config just wrote, leaving the plugin without a
    // host entry.
    clean: false,
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(packageId)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
]);

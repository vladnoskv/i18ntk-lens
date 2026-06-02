import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const manifest = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as {
  publisher: string;
  version: string;
  contributes?: {
    viewsContainers?: unknown;
    commands?: Array<{ command: string }>;
    configuration?: { properties?: Record<string, { default?: unknown; items?: { enum?: string[] } }> };
  };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

test('manifest keeps Lens standalone without adding a second Activity Bar icon', () => {
  assert.equal(manifest.publisher, 'VladNoskov');
  assert.equal(manifest.contributes?.viewsContainers, undefined);
  assert.deepEqual(
    manifest.contributes?.commands?.map((entry) => entry.command).sort(),
    ['i18ntkLens.addAutoTranslatePlaceholder', 'i18ntkLens.openKeyInLocaleFiles', 'i18ntkLens.openSettings', 'i18ntkLens.scan']
  );
});

test('manifest exposes configurable key formats', () => {
  const keyFormats = manifest.contributes?.configuration?.properties?.['i18ntkLens.keyFormats'];

  assert.deepEqual(keyFormats?.default, ['dot', 'snake']);
  assert.deepEqual(keyFormats?.items?.enum, ['dot', 'snake']);
});

test('manifest exposes extension UI language setting', () => {
  const language = manifest.contributes?.configuration?.properties?.['i18ntkLens.extensionLanguage'] as any;

  assert.equal(language?.default, 'auto');
  assert.deepEqual(language?.enum, ['auto', 'en', 'es', 'fr', 'de']);
});

test('manifest keeps Lens automatic scans disabled by default', () => {
  const properties = manifest.contributes?.configuration?.properties as Record<string, any>;

  assert.equal(properties?.['i18ntkLens.scanOnStartup']?.default, false);
  assert.equal(properties?.['i18ntkLens.autoScanOnSave']?.default, false);
});

test('package scripts include compile, locale asset copy, unit test, aggregate test, and package commands', () => {
  assert.equal(manifest.scripts?.compile, 'tsc -p . && node scripts/copy-i18ntk-locales.js');
  assert.equal(manifest.scripts?.['test:unit'], 'node --test out/test/unit/*.test.js');
  assert.equal(manifest.scripts?.test, 'npm run compile && npm run test:unit');
  assert.equal(manifest.scripts?.package, `vsce package --out ../i18ntk-lens-${manifest.version}.vsix`);
  assert.ok(manifest.dependencies?.i18ntk);
  assert.ok(manifest.devDependencies?.['@vscode/vsce']);
  assert.equal(manifest.devDependencies?.vsce, undefined);
});

test('manifest depends on the packaged i18ntk runtime', () => {
  assert.equal(manifest.dependencies?.i18ntk, 'file:../i18ntk-4.4.2.tgz');
});

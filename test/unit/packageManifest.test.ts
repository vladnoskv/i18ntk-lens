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
  };
  scripts?: Record<string, string>;
};

test('manifest keeps Lens standalone without adding a second Activity Bar icon', () => {
  assert.equal(manifest.publisher, 'VladNoskov');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.contributes?.viewsContainers, undefined);
  assert.deepEqual(
    manifest.contributes?.commands?.map((entry) => entry.command).sort(),
    ['i18ntkLens.openKeyInLocaleFiles', 'i18ntkLens.openSettings', 'i18ntkLens.scan']
  );
});

test('package scripts include compile, unit test, aggregate test, and package commands', () => {
  assert.equal(manifest.scripts?.compile, 'tsc -p .');
  assert.equal(manifest.scripts?.['test:unit'], 'node --test out/test/unit/*.test.js');
  assert.equal(manifest.scripts?.test, 'npm run compile && npm run test:unit');
  assert.equal(manifest.scripts?.package, 'vsce package --out ../i18ntk-lens-1.0.0.vsix');
});

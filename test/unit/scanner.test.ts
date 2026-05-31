import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findTranslationKeyAt, findTranslationKeys, scanWorkspace } from '../../src/scanner';

test('findTranslationKeys detects built-in and custom wrappers once', () => {
  const text = [
    'const a = t("home.title");',
    'const b = i18n.t("home.subtitle");',
    'const c = tx("checkout.pay");',
    'const d = msg("account.name");'
  ].join('\n');

  const keys = findTranslationKeys(text, ['msg']).map((match) => match.key);

  assert.deepEqual(keys, ['home.title', 'home.subtitle', 'checkout.pay', 'account.name']);
});

test('findTranslationKeyAt returns the key at an offset', () => {
  const text = 'const title = t("home.title");';
  const offset = text.indexOf('home.title') + 2;

  assert.equal(findTranslationKeyAt(text, offset)?.key, 'home.title');
});

test('scanWorkspace reports missing and unused keys for directory-per-locale projects', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'i18ntk-lens-'));
  await fs.mkdir(path.join(root, 'locales', 'en'), { recursive: true });
  await fs.mkdir(path.join(root, 'locales', 'fr'), { recursive: true });
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'locales', 'en', 'common.json'), JSON.stringify({
    home: { title: 'Home', unused: 'Unused' }
  }));
  await fs.writeFile(path.join(root, 'locales', 'fr', 'common.json'), JSON.stringify({
    home: { title: 'Accueil' }
  }));
  await fs.writeFile(path.join(root, 'src', 'app.ts'), 'const title = t("home.title");\nconst missing = t("home.missing");');

  const result = await scanWorkspace({
    rootPath: root,
    localeDirectory: path.join(root, 'locales'),
    sourceLocale: 'en',
    maxScanFiles: 100,
    exclude: ['node_modules', '.git']
  });

  assert.deepEqual(result.locales, ['en', 'fr']);
  assert.equal(result.usages.length, 2);
  assert.deepEqual(result.missing.map((item) => [item.key, item.locales]), [
    ['home.missing', ['en', 'fr']]
  ]);
  assert.deepEqual(result.unused.map((item) => item.key), ['home.unused']);
});

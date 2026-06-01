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

test('findTranslationKeys ignores non-translation function and method string arguments', () => {
  const text = [
    'const next = searchParams.get("next");',
    'window.localStorage.setItem("pending", "1");',
    'settingsRes.headers.get("etag");',
    'clearWaitlist("pending");',
    'clearWaitlist("admin.panel");',
    'response.headers.set("Clear-Site-Data", "\\"cache\\", \\"storage\\"");',
    'const title = t("home.title");'
  ].join('\n');

  const keys = findTranslationKeys(text).map((match) => match.key);

  assert.deepEqual(keys, ['home.title']);
});

test('findTranslationKeys detects dynamic template prefixes', () => {
  const text = [
    'const topic = tx(`news.page.topics.${item}`);',
    'const title = t(`home.sections.${section}.title`);'
  ].join('\n');

  const matches = findTranslationKeys(text);

  assert.deepEqual(matches.map((match) => [match.key, match.dynamic]), [
    ['news.page.topics.', true],
    ['home.sections.', true]
  ]);
});

test('findTranslationKeys resolves dynamic templates from static values', () => {
  const text = [
    'const item = "sports";',
    'const direct = tx(`news.page.topics.${item}`);',
    'const topics = ["sports", "weather"];',
    'topics.map((topic) => tx(`news.page.topics.${topic}`));'
  ].join('\n');

  const matches = findTranslationKeys(text);

  assert.deepEqual(matches.map((match) => [match.key, match.dynamic, match.resolvedKeys]), [
    ['news.page.topics.', true, ['news.page.topics.sports']],
    ['news.page.topics.', true, ['news.page.topics.sports', 'news.page.topics.weather']]
  ]);
});

test('findTranslationKeys detects keys read from imported locale runtime objects', () => {
  const text = [
    'import common from "../locales/en/common.json";',
    'const save = common.save;',
    'const retry = common.actions.retry;'
  ].join('\n');

  const matches = findTranslationKeys(text);

  assert.deepEqual(matches.map((match) => match.key), ['common.save', 'common.actions.retry']);
});

test('findTranslationKeys expands preloaded namespace helpers', () => {
  const text = [
    'const tx = useTranslations("news.page");',
    'const heading = tx("heading");',
    'const topic = tx(`topics.${item}`);',
    'const dynamicTopic = tx(item);'
  ].join('\n');

  const matches = findTranslationKeys(text);

  assert.deepEqual(matches.map((match) => [match.key, match.dynamic]), [
    ['news.page.heading', false],
    ['news.page.topics.', true],
    ['news.page.', true]
  ]);
});

test('findTranslationKeys supports snake case when enabled', () => {
  const text = [
    'const a = t("home_title");',
    'const b = t("home.title");'
  ].join('\n');

  assert.deepEqual(findTranslationKeys(text, [], ['dot']).map((match) => match.key), ['home.title']);
  assert.deepEqual(findTranslationKeys(text, [], ['dot', 'snake']).map((match) => match.key), ['home_title', 'home.title']);
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
    exclude: ['node_modules', '.git'],
    keyFormats: ['dot']
  });

  assert.deepEqual(result.locales, ['en', 'fr']);
  assert.equal(result.usages.length, 2);
  assert.deepEqual(result.missing.map((item) => [item.key, item.locales]), [
    ['home.missing', ['en', 'fr']]
  ]);
  assert.deepEqual(result.unused.map((item) => item.key), ['home.unused']);
});

test('scanWorkspace treats dynamic prefixes and snake aliases as used keys', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'i18ntk-lens-'));
  await fs.mkdir(path.join(root, 'locales'), { recursive: true });
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'locales', 'en.json'), JSON.stringify({
    news: { page: { topics: { sports: 'Sports' } } },
    home: { title: 'Home' },
    account_name: 'Account'
  }));
  await fs.writeFile(path.join(root, 'locales', 'fr.json'), JSON.stringify({
    news: { page: { topics: { sports: 'Sports FR' } } },
    home_title: 'Accueil',
    account: { name: 'Compte' }
  }));
  await fs.writeFile(path.join(root, 'src', 'app.ts'), [
    'const txNews = useTranslations("news.page");',
    'const topic = txNews(item);',
    'const title = t("home_title");',
    'const account = t("account.name");'
  ].join('\n'));

  const result = await scanWorkspace({
    rootPath: root,
    localeDirectory: path.join(root, 'locales'),
    sourceLocale: 'en',
    maxScanFiles: 100,
    exclude: ['node_modules', '.git'],
    keyFormats: ['dot', 'snake']
  });

  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.unused, []);
});

test('scanWorkspace uses resolved runtime candidates for missing and unused checks', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'i18ntk-lens-'));
  await fs.mkdir(path.join(root, 'locales'), { recursive: true });
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'locales', 'en.json'), JSON.stringify({
    news: { page: { topics: { sports: 'Sports', weather: 'Weather', unused: 'Unused' } } }
  }));
  await fs.writeFile(path.join(root, 'locales', 'fr.json'), JSON.stringify({
    news: { page: { topics: { sports: 'Sports FR' } } }
  }));
  await fs.writeFile(path.join(root, 'src', 'app.ts'), [
    'const topics = ["sports", "weather"];',
    'topics.map((item) => tx(`news.page.topics.${item}`));'
  ].join('\n'));

  const result = await scanWorkspace({
    rootPath: root,
    localeDirectory: path.join(root, 'locales'),
    sourceLocale: 'en',
    maxScanFiles: 100,
    exclude: ['node_modules', '.git'],
    keyFormats: ['dot']
  });

  assert.deepEqual(result.missing.map((item) => [item.key, item.locales]), [
    ['news.page.topics.weather', ['fr']]
  ]);
  assert.deepEqual(result.unused.map((item) => item.key), ['news.page.topics.unused']);
});

test('scanWorkspace treats imported namespace object property reads as key usage', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'i18ntk-lens-'));
  await fs.mkdir(path.join(root, 'locales', 'en'), { recursive: true });
  await fs.mkdir(path.join(root, 'locales', 'fr'), { recursive: true });
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'locales', 'en', 'common.json'), JSON.stringify({
    save: 'Save',
    actions: { retry: 'Retry' },
    unused: 'Unused'
  }));
  await fs.writeFile(path.join(root, 'locales', 'fr', 'common.json'), JSON.stringify({
    save: 'Enregistrer',
    actions: { retry: 'Reessayer' }
  }));
  await fs.writeFile(path.join(root, 'src', 'app.ts'), [
    'import common from "../locales/en/common.json";',
    'const save = common.save;',
    'const retry = common.actions.retry;'
  ].join('\n'));

  const result = await scanWorkspace({
    rootPath: root,
    localeDirectory: path.join(root, 'locales'),
    sourceLocale: 'en',
    maxScanFiles: 100,
    exclude: ['node_modules', '.git'],
    keyFormats: ['dot']
  });

  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.unused.map((item) => item.key), ['unused']);
});

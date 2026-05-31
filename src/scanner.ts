import fs from 'node:fs';
import path from 'node:path';

export interface TextRange {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export interface KeyMatch {
  key: string;
  start: number;
  end: number;
  range: TextRange;
}

export interface LensConfig {
  rootPath: string;
  localeDirectory: string;
  sourceLocale: string;
  maxScanFiles: number;
  exclude: string[];
}

export interface LensScanResult {
  locales: string[];
  keyValues: Record<string, Record<string, string>>;
  keyFiles: Record<string, string[]>;
  usages: Array<{ key: string; filePath: string; range: TextRange }>;
  missing: Array<{ key: string; locales: string[]; filePath: string; range: TextRange }>;
  unused: Array<{ key: string; filePath: string }>;
}

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.html']);
const KNOWN_WRAPPERS = [
  /\b(?<![\w.])t\s*\(\s*(['"`])([^'"`]+)\1/g,
  /\bi18n\.t\s*\(\s*(['"`])([^'"`]+)\1/g,
  /\btranslate\s*\(\s*(['"`])([^'"`]+)\1/g,
  /\$t\s*\(\s*(['"`])([^'"`]+)\1/g,
  /\btx\s*\(\s*(['"`])([^'"`]+)\1/g,
  /\b__\s*\(\s*(['"`])([^'"`]+)\1/g,
  /\b_t\s*\(\s*(['"`])([^'"`]+)\1/g,
  /\b__t\s*\(\s*(['"`])([^'"`]+)\1/g,
  /\bi18n\s*\(\s*(['"`])([^'"`]+)\1/g,
];

const GENERIC_KEY_PATTERN = /\b[a-zA-Z_$][\w$]*\s*\(\s*(['"`])([a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+)\1/g;

export async function scanWorkspace(config: LensConfig, customWrappers: string[] = []): Promise<LensScanResult> {
  const localeFiles = await discoverLocaleFiles(config.localeDirectory);
  const locales = [...new Set(localeFiles.map((file) => file.locale))].sort();
  const keyValues: Record<string, Record<string, string>> = {};
  const keyFiles: Record<string, string[]> = {};
  for (const file of localeFiles) {
    keyValues[file.locale] = { ...(keyValues[file.locale] ?? {}), ...file.values };
    for (const key of Object.keys(file.values)) {
      keyFiles[key] = [...(keyFiles[key] ?? []), file.filePath];
    }
  }

  const sourceFiles = await findFiles(config.rootPath, config.exclude, config.maxScanFiles);
  const usages = [];
  for (const filePath of sourceFiles) {
    const text = await fs.promises.readFile(filePath, 'utf8').catch(() => '');
    for (const match of findTranslationKeys(text, customWrappers)) {
      usages.push({ key: match.key, filePath, range: match.range });
    }
  }

  const missing = usages
    .map((usage) => ({
      ...usage,
      locales: locales.filter((locale) => keyValues[locale]?.[usage.key] === undefined)
    }))
    .filter((item) => item.locales.length > 0);
  const used = new Set(usages.map((usage) => usage.key));
  const unused = Object.keys(keyValues[config.sourceLocale] ?? {})
    .filter((key) => !used.has(key))
    .map((key) => ({ key, filePath: keyFiles[key]?.[0] ?? config.localeDirectory }));

  return { locales, keyValues, keyFiles, usages, missing, unused };
}

export function findTranslationKeys(text: string, customWrappers: string[] = []): KeyMatch[] {
  const allPatterns = [...KNOWN_WRAPPERS];
  for (const name of customWrappers) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    allPatterns.push(new RegExp(`\\b${escaped}\\s*\\(\\s*(['\x60"])([^'"\x60]+)\\1`, 'g'));
  }
  const matches: KeyMatch[] = [];
  for (const pattern of allPatterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const key = match[2];
      const start = match.index + match[0].indexOf(key);
      const end = start + key.length;
      matches.push({ key, start, end, range: rangeFromOffsets(text, start, end) });
    }
  }
  GENERIC_KEY_PATTERN.lastIndex = 0;
  let gMatch: RegExpExecArray | null;
  while ((gMatch = GENERIC_KEY_PATTERN.exec(text)) !== null) {
    const key = gMatch[2];
    if (/^(if|for|while|return|function|class|const|let|var|import|export|new|typeof|instanceof|delete|void)$/.test(key)) continue;
    const start = gMatch.index + gMatch[0].indexOf(key);
    const end = start + key.length;
    matches.push({ key, start, end, range: rangeFromOffsets(text, start, end) });
  }
  return dedupe(matches).sort((a, b) => a.start - b.start);
}

function dedupe(matches: KeyMatch[]): KeyMatch[] {
  const seen = new Set<string>();
  return matches.filter((m) => {
    const id = `${m.start}:${m.end}:${m.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function findTranslationKeyAt(text: string, offset: number, customWrappers: string[] = []): KeyMatch | undefined {
  return findTranslationKeys(text, customWrappers).find((match) => offset >= match.start && offset <= match.end);
}

async function discoverLocaleFiles(localeDirectory: string): Promise<Array<{ locale: string; filePath: string; values: Record<string, string> }>> {
  const files = [];
  const entries = await fs.promises.readdir(localeDirectory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(localeDirectory, entry.name);
    if (entry.isDirectory()) {
      const childEntries = await fs.promises.readdir(fullPath, { withFileTypes: true }).catch(() => []);
      for (const child of childEntries) {
        if (child.isFile() && child.name.endsWith('.json')) {
          const loaded = await loadLocaleFile(entry.name, path.join(fullPath, child.name));
          if (loaded) files.push(loaded);
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const loaded = await loadLocaleFile(path.basename(entry.name, '.json'), fullPath);
      if (loaded) files.push(loaded);
    }
  }
  return files;
}

async function loadLocaleFile(locale: string, filePath: string): Promise<{ locale: string; filePath: string; values: Record<string, string> } | undefined> {
  try {
    const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    return { locale, filePath, values: flattenJson(data) };
  } catch {
    return undefined;
  }
}

function flattenJson(value: unknown, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      Object.assign(result, flattenJson(child, fullKey));
    } else if (typeof child === 'string') {
      result[fullKey] = child;
    }
  }
  return result;
}

async function findFiles(rootPath: string, exclude: string[], maxFiles: number): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    if (files.length >= maxFiles || isExcluded(directory, exclude)) return;
    const entries = await fs.promises.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (isExcluded(fullPath, exclude)) continue;
      if (entry.isDirectory()) await visit(fullPath);
      if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(fullPath);
      if (files.length >= maxFiles) return;
    }
  }
  await visit(rootPath);
  return files;
}

function isExcluded(filePath: string, exclude: string[]): boolean {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return exclude.some((item) => parts.includes(item));
}

function rangeFromOffsets(text: string, start: number, end: number): TextRange {
  const startPos = positionAt(text, start);
  const endPos = positionAt(text, end);
  return {
    startLine: startPos.line,
    startCharacter: startPos.character,
    endLine: endPos.line,
    endCharacter: endPos.character
  };
}

function positionAt(text: string, offset: number): { line: number; character: number } {
  const before = text.slice(0, offset);
  const lines = before.split(/\r?\n/);
  return { line: lines.length - 1, character: lines[lines.length - 1].length };
}

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
  dynamic: boolean;
  resolvedKeys?: string[];
  start: number;
  end: number;
  range: TextRange;
}

export type KeyFormat = 'dot' | 'snake';

export interface LensConfig {
  rootPath: string;
  localeDirectory: string;
  sourceLocale: string;
  maxScanFiles: number;
  exclude: string[];
  keyFormats: KeyFormat[];
}

export interface LensScanResult {
  locales: string[];
  keyValues: Record<string, Record<string, string>>;
  keyFiles: Record<string, string[]>;
  usages: Array<{ key: string; filePath: string; range: TextRange }>;
  missing: Array<{ key: string; locales: string[]; filePath: string; range: TextRange }>;
  unused: Array<{ key: string; filePath: string }>;
  autoTranslateResiduals: Array<{ key: string; locale: string; value: string; fileName?: string; filePath?: string; range?: TextRange }>;
}

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.mts', '.cjs', '.cts', '.vue', '.svelte', '.astro', '.mdx', '.html', '.rs']);
const MAX_SOURCE_USAGE_SCAN_BYTES = 2 * 1024 * 1024;
const KNOWN_WRAPPERS = ['t', 'i18n.t', 'translate', '$t', 'tx', '__', '_t', '__t', 'i18n'];
const NAMESPACE_HELPERS = [
  'useTranslations',
  'getTranslations',
  'useTranslation',
  'useScopedI18n',
  'useI18n',
  'createTranslator',
  'createI18n'
];

export async function scanWorkspace(config: LensConfig, customWrappers: string[] = []): Promise<LensScanResult> {
  const keyFormats = normalizeKeyFormats(config.keyFormats);
  const localeFiles = await discoverLocaleFiles(config.localeDirectory);
  const locales = [...new Set(localeFiles.map((file) => file.locale))].sort();
  const keyValues: Record<string, Record<string, string>> = {};
  const keyFiles: Record<string, string[]> = {};
  const canonicalKeysByLocale: Record<string, Set<string>> = {};
  for (const file of localeFiles) {
    keyValues[file.locale] = { ...(keyValues[file.locale] ?? {}) };
    canonicalKeysByLocale[file.locale] = canonicalKeysByLocale[file.locale] ?? new Set<string>();
    for (const [key, value] of Object.entries(file.values)) {
      canonicalKeysByLocale[file.locale].add(key);
      for (const alias of aliasesForKey(key, keyFormats)) {
        keyValues[file.locale][alias] = keyValues[file.locale][alias] ?? value;
        keyFiles[alias] = [...(keyFiles[alias] ?? []), file.filePath];
      }
    }
  }

  const sourceFiles = await findFiles(config.rootPath, config.exclude, config.maxScanFiles);
  const usages: Array<{ key: string; dynamic: boolean; filePath: string; range: TextRange }> = [];
  for (const filePath of sourceFiles) {
    const text = await fs.promises.readFile(filePath, 'utf8').catch(() => '');
    if (text.length > MAX_SOURCE_USAGE_SCAN_BYTES) continue;
    for (const match of findTranslationKeys(text, customWrappers, keyFormats)) {
      const usageKeys = selectUsageKeys(match, locales, keyValues, keyFormats);
      if (usageKeys.length) {
        for (const key of usageKeys) {
          usages.push({ key, dynamic: false, filePath, range: match.range });
        }
        continue;
      }
      usages.push({ key: match.key, dynamic: match.dynamic, filePath, range: match.range });
    }
  }

  const missing = usages
    .map((usage) => ({
      key: usage.key,
      filePath: usage.filePath,
      range: usage.range,
      locales: locales.filter((locale) => !usageExistsInLocale(usage, keyValues[locale] ?? {}, keyFormats))
    }))
    .filter((item) => item.locales.length > 0);
  const unused = [...(canonicalKeysByLocale[config.sourceLocale] ?? new Set<string>())]
    .filter((key) => !usages.some((usage) => usageMatchesKey(usage, key, keyFormats)))
    .map((key) => ({ key, filePath: keyFiles[key]?.[0] ?? config.localeDirectory }));

  const autoTranslateResiduals = await collectAutoTranslateResiduals(config.rootPath, localeFiles);
  return { locales, keyValues, keyFiles, usages, missing, unused, autoTranslateResiduals };
}

export function findTranslationKeys(text: string, customWrappers: string[] = [], keyFormats: KeyFormat[] = ['dot', 'snake']): KeyMatch[] {
  const formats = normalizeKeyFormats(keyFormats);
  const namespaces = findNamespaceBindings(text);
  const staticValues = findStaticRuntimeValues(text);
  const importedObjects = findImportedLocaleObjects(text);
  const wrapperNames = [...new Set([...KNOWN_WRAPPERS, ...customWrappers, ...namespaces.keys()].filter(Boolean))];
  const matches: KeyMatch[] = [];
  for (const name of wrapperNames) {
    matches.push(...findCallsForName(text, name, namespaces.get(name), formats, staticValues, true));
  }
  for (const [name, namespace] of namespaces) {
    matches.push(...findRuntimeNamespaceCalls(text, name, namespace, staticValues));
  }
  for (const [name, namespace] of importedObjects) {
    matches.push(...findImportedLocaleObjectReads(text, name, namespace));
  }
  for (const match of findJsxComponentKeys(text)) {
    matches.push(match);
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

export function findTranslationKeyAt(text: string, offset: number, customWrappers: string[] = [], keyFormats: KeyFormat[] = ['dot', 'snake']): KeyMatch | undefined {
  return findTranslationKeys(text, customWrappers, keyFormats).find((match) => offset >= match.start && offset <= match.end);
}

function findCallsForName(
  text: string,
  name: string,
  namespace: string | undefined,
  keyFormats: KeyFormat[],
  staticValues: Map<string, string[]>,
  allowSingleSegment: boolean
): KeyMatch[] {
  // Safety: reject excessively long wrapper names that could cause ReDoS
  if (name.length > 100) return [];
  const matches: KeyMatch[] = [];
  const pattern = new RegExp(`${callBoundaryForName(name)}${escapeRegExp(name)}\\s*\\(\\s*(['"\`])`, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const quote = match[1];
    const contentStart = pattern.lastIndex;
    const contentEnd = findQuotedContentEnd(text, contentStart, quote);
    if (contentEnd === -1) {
      pattern.lastIndex = contentStart + 1;
      continue;
    }
    const content = text.slice(contentStart, contentEnd);
    const key = parseKeyContent(content, quote, namespace, keyFormats, staticValues, allowSingleSegment);
    if (key) {
      const start = contentStart;
      const end = key.dynamic ? contentStart + content.indexOf('${') : contentEnd;
      matches.push({ ...key, start, end, range: rangeFromOffsets(text, start, end) });
    }
    pattern.lastIndex = contentEnd + 1;
  }
  return matches;
}

function findRuntimeNamespaceCalls(text: string, name: string, namespace: string, staticValues: Map<string, string[]>): KeyMatch[] {
  const matches: KeyMatch[] = [];
  const patternSource = callBoundaryForName(name) + escapeRegExp(name) + "\\s*\\(\\s*([^\\s'\"`][^,)]*)";
  const pattern = new RegExp(patternSource, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const expression = match[1].trim();
    if (!expression || expression.startsWith('{') || expression.startsWith('[')) continue;
    const parenStart = match[0].indexOf('(') + 1;
    const argText = match[0].slice(parenStart).trimStart();
    const exprOffset = match[0].slice(parenStart).indexOf(argText);
    const start = match.index + parenStart + exprOffset;
    const end = start + expression.length;
    const resolvedKeys = resolveExpressionValues(expression, staticValues).map((value) => joinNamespace(namespace, value));
    const key = namespace.endsWith('.') || namespace.endsWith('_') ? namespace : `${namespace}.`;
    matches.push({
      key,
      dynamic: true,
      resolvedKeys: resolvedKeys.length ? resolvedKeys : undefined,
      start,
      end,
      range: rangeFromOffsets(text, start, end)
    });
  }
  return matches;
}

function parseKeyContent(
  content: string,
  quote: string,
  namespace: string | undefined,
  keyFormats: KeyFormat[],
  staticValues: Map<string, string[]>,
  allowSingleSegment: boolean
): Pick<KeyMatch, 'key' | 'dynamic' | 'resolvedKeys'> | undefined {
  const interpolationIndex = quote === '`' ? content.indexOf('${') : -1;
  if (interpolationIndex >= 0) {
    const prefix = content.slice(0, interpolationIndex);
    if (!prefix || !isLikelyKeyPrefix(prefix, keyFormats, allowSingleSegment)) return undefined;
    const resolvedKeys = resolveTemplateKeys(content, namespace, staticValues, keyFormats, allowSingleSegment);
    return {
      key: joinNamespace(namespace, prefix),
      dynamic: true,
      resolvedKeys: resolvedKeys.length ? resolvedKeys : undefined
    };
  }
  if (!isLikelyKey(content, keyFormats, allowSingleSegment || Boolean(namespace))) return undefined;
  return { key: joinNamespace(namespace, content), dynamic: false };
}

function findStaticRuntimeValues(text: string): Map<string, string[]> {
  const values = new Map<string, string[]>();
  const stringDeclaration = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])([^'"`${}\\]*(?:\\.[^'"`${}\\]*)*)\2/g;
  let match: RegExpExecArray | null;
  while ((match = stringDeclaration.exec(text)) !== null) {
    values.set(match[1], [unescapeStringLiteral(match[3])]);
  }

  const arrayDeclaration = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[/g;
  while ((match = arrayDeclaration.exec(text)) !== null) {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = findMatchingBracket(text, bodyStart - 1);
    if (bodyEnd === -1) continue;
    const body = text.slice(bodyStart, bodyEnd);
    const entries = extractStringLiterals(body);
    if (entries.length) values.set(match[1], entries);
  }

  const arrayIterator = /\b([A-Za-z_$][\w$]*)\s*\.\s*(?:map|forEach|filter|some|every)\s*\(\s*(?:async\s*)?\(?\s*([A-Za-z_$][\w$]*)/g;
  while ((match = arrayIterator.exec(text)) !== null) {
    const sourceValues = values.get(match[1]);
    if (sourceValues?.length) values.set(match[2], sourceValues);
  }
  return values;
}

function resolveTemplateKeys(
  content: string,
  namespace: string | undefined,
  staticValues: Map<string, string[]>,
  keyFormats: KeyFormat[],
  allowSingleSegment: boolean
): string[] {
  const parts: Array<string | string[]> = [];
  let cursor = 0;
  const interpolation = /\$\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = interpolation.exec(content)) !== null) {
    parts.push(content.slice(cursor, match.index));
    const values = resolveExpressionValues(match[1], staticValues);
    if (!values.length) return [];
    parts.push(values);
    cursor = match.index + match[0].length;
  }
  parts.push(content.slice(cursor));

  const keys = expandTemplateParts(parts)
    .map((key) => joinNamespace(namespace, key))
    .filter((key) => isLikelyKey(key, keyFormats, allowSingleSegment || Boolean(namespace)));
  return [...new Set(keys)];
}

function resolveExpressionValues(expression: string, staticValues: Map<string, string[]>): string[] {
  const trimmed = expression.trim();
  const literal = /^(['"`])([^'"`${}\\]*(?:\\.[^'"`${}\\]*)*)\1$/.exec(trimmed);
  if (literal) return [unescapeStringLiteral(literal[2])];
  const identifier = /^[A-Za-z_$][\w$]*$/.exec(trimmed);
  if (identifier) return staticValues.get(trimmed) ?? [];
  return [];
}

function expandTemplateParts(parts: Array<string | string[]>): string[] {
  let results = [''];
  for (const part of parts) {
    const values = Array.isArray(part) ? part : [part];
    results = results.flatMap((prefix) => values.map((value) => `${prefix}${value}`));
  }
  return results;
}

function extractStringLiterals(value: string): string[] {
  const literals: string[] = [];
  const pattern = /(['"`])([^'"`${}\\]*(?:\\.[^'"`${}\\]*)*)\1/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    literals.push(unescapeStringLiteral(match[2]));
  }
  return literals;
}

function unescapeStringLiteral(value: string): string {
  return value.replace(/\\(['"`\\])/g, '$1');
}

function findImportedLocaleObjects(text: string): Map<string, string> {
  const imports = new Map<string, string>();
  const importPattern = /\bimport\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(text)) !== null) {
    const namespace = namespaceFromImport(match[1], match[2]);
    if (namespace) imports.set(match[1], namespace);
  }

  const requirePattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requirePattern.exec(text)) !== null) {
    const namespace = namespaceFromImport(match[1], match[2]);
    if (namespace) imports.set(match[1], namespace);
  }
  return imports;
}

function namespaceFromImport(localName: string, specifier: string): string | undefined {
  const normalized = specifier.replace(/\\/g, '/');
  if (!/\.json($|\?)/.test(normalized) && !/(^|\/)(locales|locale|i18n|translations)(\/|$)/i.test(normalized)) return undefined;
  return normalized.split('/').pop()?.replace(/\.json(?:\?.*)?$/, '') || localName;
}

function findImportedLocaleObjectReads(text: string, name: string, namespace: string): KeyMatch[] {
  const matches: KeyMatch[] = [];
  const pattern = new RegExp(`(?<![\\w$'"./-])${escapeRegExp(name)}\\.([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*)`, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const propertyPath = match[1];
    const start = match.index;
    const end = start + match[0].length;
    matches.push({
      key: `${namespace}.${propertyPath}`,
      dynamic: false,
      resolvedKeys: [propertyPath],
      start,
      end,
      range: rangeFromOffsets(text, start, end)
    });
  }
  return matches;
}

function findJsxComponentKeys(text: string): KeyMatch[] {
  const matches: KeyMatch[] = [];
  const patterns = [
    /<(?:Trans)\s[\s\S]*?\bi18nKey\s*=\s*(?:\{|)(['"`])([^'"`}]+)\1[^>]*>/g,
    /<(?:FormattedMessage)\s[\s\S]*?\bid\s*=\s*(?:\{|)(['"`])([^'"`}]+)\1[^>]*>/g,
    /<(?:FormattedMessage)\s[\s\S]*?\bdefaultMessage\s*=\s*(?:\{|)(['"`])([^'"`}]+)\1[^>]*>/g,
    /<(?:t)\s[\s\S]*?\bmessage\s*=\s*(?:\{|)(['"`])([^'"`}]+)\1[^>]*>/g,
    /<(?:Translate)\s[\s\S]*?\bid\s*=\s*(?:\{|)(['"`])([^'"`}]+)\1[^>]*>/g
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const key = match[2];
      const start = match.index + match[0].indexOf(key);
      const end = start + key.length;
      if (/^[A-Za-z][A-Za-z0-9._-]*(?:\.[A-Za-z][A-Za-z0-9._-]*)*$/.test(key)) {
        matches.push({ key, dynamic: false, start, end, range: rangeFromOffsets(text, start, end) });
      }
    }
  }
  return matches;
}

function findNamespaceBindings(text: string): Map<string, string> {
  const bindings = new Map<string, string>();
  const helpers = NAMESPACE_HELPERS.map(escapeRegExp).join('|');
  const assignedHelper = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:await\\s+)?(?:${helpers})\\s*\\(([^)]*)\\)`, 'g');
  let match: RegExpExecArray | null;
  while ((match = assignedHelper.exec(text)) !== null) {
    const namespace = extractNamespaceArgument(match[2]);
    if (namespace) bindings.set(match[1], namespace);
  }

  const destructuredHelper = new RegExp(`\\b(?:const|let|var)\\s*\\{\\s*(?:t\\s*:\\s*)?([A-Za-z_$][\\w$]*)\\s*\\}\\s*=\\s*(?:await\\s+)?(?:${helpers})\\s*\\(([^)]*)\\)`, 'g');
  while ((match = destructuredHelper.exec(text)) !== null) {
    const namespace = extractNamespaceArgument(match[2]);
    if (namespace) bindings.set(match[1], namespace);
  }
  return bindings;
}

function extractNamespaceArgument(args: string): string | undefined {
  const keyPrefix = /\bkeyPrefix\s*:\s*(['"`])([^'"`${}]+)\1/.exec(args);
  if (keyPrefix) return keyPrefix[2];
  const literal = /(['"`])([^'"`${}]+)\1/.exec(args);
  return literal?.[2];
}

function findQuotedContentEnd(text: string, start: number, quote: string): number {
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '\\') {
      index += 1;
      continue;
    }
    if (text[index] === quote) return index;
  }
  return -1;
}

function callBoundaryForName(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? '(?<![\\w$.])' : '(?<![\\w$])';
}

function joinNamespace(namespace: string | undefined, key: string): string {
  if (!namespace) return key;
  if (!key) return namespace;
  if (namespace.endsWith('.') || namespace.endsWith('_')) return `${namespace}${key}`;
  if (namespace.includes('_') && !namespace.includes('.')) return `${namespace}_${key}`;
  return `${namespace}.${key}`;
}

function isLikelyKey(key: string, keyFormats: KeyFormat[], allowSingleSegment: boolean): boolean {
  if (!key || /\s/.test(key)) return false;
  if (allowSingleSegment && /^[A-Za-z][A-Za-z0-9-]*$/.test(key)) return true;
  if (keyFormats.includes('dot') && /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+$/.test(key)) return true;
  if (keyFormats.includes('snake') && /^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z][A-Za-z0-9]*)+$/.test(key)) return true;
  return false;
}

function isLikelyKeyPrefix(prefix: string, keyFormats: KeyFormat[], allowSingleSegment: boolean): boolean {
  if (!prefix || /\s/.test(prefix)) return false;
  const trimmed = prefix.replace(/[._-]$/, '');
  return isLikelyKey(trimmed, keyFormats, allowSingleSegment);
}

function aliasesForKey(key: string, keyFormats: KeyFormat[]): Set<string> {
  const aliases = new Set([key]);
  if (keyFormats.includes('dot') && key.includes('_')) aliases.add(key.replace(/_/g, '.'));
  if (keyFormats.includes('snake') && key.includes('.')) aliases.add(key.replace(/\./g, '_'));
  return aliases;
}

function usageExistsInLocale(usage: { key: string; dynamic: boolean }, localeValues: Record<string, string>, keyFormats: KeyFormat[]): boolean {
  if (usage.dynamic) {
    return [...aliasesForKey(usage.key, keyFormats)].some((prefix) => Object.keys(localeValues).some((key) => key.startsWith(prefix)));
  }
  return [...aliasesForKey(usage.key, keyFormats)].some((key) => localeValues[key] !== undefined);
}

function usageMatchesKey(usage: { key: string; dynamic: boolean }, key: string, keyFormats: KeyFormat[]): boolean {
  const keyAliases = aliasesForKey(key, keyFormats);
  const usageAliases = aliasesForKey(usage.key, keyFormats);
  if (usage.dynamic) {
    return [...usageAliases].some((prefix) => [...keyAliases].some((keyAlias) => keyAlias.startsWith(prefix)));
  }
  return [...usageAliases].some((usageAlias) => keyAliases.has(usageAlias));
}

function selectUsageKeys(match: KeyMatch, locales: string[], keyValues: Record<string, Record<string, string>>, keyFormats: KeyFormat[]): string[] {
  const candidates = [match.key, ...(match.resolvedKeys ?? [])];
  const known = candidates.filter((key) => locales.some((locale) => usageExistsInLocale({ key, dynamic: false }, keyValues[locale] ?? {}, keyFormats)));
  return [...new Set(known.length ? known : match.resolvedKeys ?? [])];
}

function normalizeKeyFormats(keyFormats: KeyFormat[] | undefined): KeyFormat[] {
  const normalized = [...new Set((keyFormats ?? ['dot', 'snake']).filter((item): item is KeyFormat => item === 'dot' || item === 'snake'))];
  return normalized.length ? normalized : ['dot', 'snake'];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function discoverLocaleFiles(localeDirectory: string): Promise<Array<{ locale: string; filePath: string; values: Record<string, string> }>> {
  const files: Array<{ locale: string; filePath: string; values: Record<string, string> }> = [];
  const entries = await fs.promises.readdir(localeDirectory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(localeDirectory, entry.name);
    if (entry.isDirectory()) {
      await collectLocaleFiles(fullPath, entry.name, files);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const loaded = await loadLocaleFile(path.basename(entry.name, '.json'), fullPath);
      if (loaded) files.push(loaded);
    }
  }
  return files;
}

async function collectLocaleFiles(dirPath: string, locale: string, files: Array<{ locale: string; filePath: string; values: Record<string, string> }>): Promise<void> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await collectLocaleFiles(fullPath, locale, files);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const loaded = await loadLocaleFile(locale, fullPath);
      if (loaded) files.push(loaded);
    }
  }
}

async function loadLocaleFile(locale: string, filePath: string): Promise<{ locale: string; filePath: string; values: Record<string, string> } | undefined> {
  try {
    const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    return { locale, filePath, values: flattenJson(data) };
  } catch {
    return undefined;
  }
}

async function collectAutoTranslateResiduals(rootPath: string, localeFiles: Array<{ locale: string; filePath: string; values: Record<string, string> }>): Promise< LensScanResult['autoTranslateResiduals']> {
  const reportPath = path.join(rootPath, 'i18ntk-reports', 'auto-translate', 'latest.json');
  let parsed: any;
  try {
    parsed = JSON.parse(await fs.promises.readFile(reportPath, 'utf8'));
  } catch {
    return [];
  }
  if (parsed?.kind !== 'i18ntk.autoTranslateResiduals' || !Array.isArray(parsed.items)) return [];
  const locale = String(parsed.targetLang || '').trim();
  if (!locale) return [];
  return parsed.items
    .map((item: any) => {
      const key = String(item?.keyPath || '').trim();
      if (!key) return undefined;
      const fileName = String(item?.fileName || '');
      const localeFile = localeFiles.find((file) =>
        file.locale === locale &&
        file.values[key] !== undefined &&
        (!fileName || path.basename(file.filePath) === fileName)
      ) ?? localeFiles.find((file) => file.locale === locale && file.values[key] !== undefined);
      return {
        key,
        locale,
        value: String(item?.value || ''),
        fileName,
        filePath: localeFile?.filePath,
        range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 }
      };
    })
    .filter(Boolean) as LensScanResult['autoTranslateResiduals'];
}

function flattenJson(value: unknown, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  if (value === null || value === undefined) return result;
  if (Array.isArray(value)) return result;
  if (typeof value !== 'object') {
    result[prefix || 'value'] = String(value);
    return result;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      Object.assign(result, flattenJson(child, fullKey));
    } else if (child === null) {
      result[fullKey] = 'null';
    } else if (child !== undefined) {
      result[fullKey] = String(child);
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

function findMatchingBracket(text: string, openIndex: number): number {
  const open = text[openIndex];
  if (open !== '[' && open !== '{' && open !== '(') return -1;
  const close = open === '[' ? ']' : open === '{' ? '}' : ')';
  let depth = 1;
  for (let i = openIndex + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function detectSuspectedCopyFormatters(text: string): Array<{ name: string; line: number; type: string; message: string }> {
  const formatters: Array<{ name: string; line: number; type: string; message: string }> = [];
  const declarationPattern = /\b(?:const|let|var)\s+(tx)\s*=\s*(?:useCallback\s*\(|useMemo\s*\(|\([^)]*\)\s*=>|function\s*\()/g;
  let match;
  while ((match = declarationPattern.exec(text)) !== null) {
    const afterEquals = text.slice(match.index + match[0].length, Math.min(match.index + match[0].length + 500, text.length));
    const callsTranslationRuntime = /\b(?:t|i18n\.t|\.getTranslation|translate)\s*\(/.test(afterEquals);
    if (!callsTranslationRuntime) {
      const before = text.slice(0, match.index);
      formatters.push({
        name: 'tx',
        line: before.split(/\r?\n/).length,
        type: 'suspectedCopyFormatter',
        message: `Local function "tx" does not call a known translation runtime and may be a copy formatter. Rename to "copy" or configure "copyFormatters".`,
      });
    }
  }
  return formatters;
}

export function findClientBoundaryLocaleImports(text: string): Array<{ importPath: string; message: string }> {
  const issues: Array<{ importPath: string; message: string }> = [];
  const isClient = /['"]use client['"]/.test(text) || /['"]use client['"]/.test(String(text || '').slice(0, 200));
  if (!isClient) return issues;
  const importPattern = /\bimport\s+(?:\*\s+as\s+\w+|type\s+\{[^}]+\}|type\s+\*\s+as\s+\w+|\{[^}]*\}|\w+)\s+from\s+['"]([^'"]+\.json)['"]/g;
  let match;
  while ((match = importPattern.exec(text)) !== null) {
    if (/\b(locales?|i18n|translations?)\b/i.test(match[1])) {
      issues.push({
        importPath: match[1],
        message: `"use client" file imports locale JSON (${match[1]}). This bypasses the translation runtime and increases client bundle size. Use a server bridge route instead.`,
      });
    }
  }
  return issues;
}

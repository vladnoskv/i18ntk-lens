import * as vscode from 'vscode';
import fs from 'node:fs';
import path from 'node:path';
import { findTranslationKeyAt, findTranslationKeys, LensConfig, LensScanResult, scanWorkspace } from './scanner';
import { LensSettingsPanel } from './webview/settingsWebview';

const SELECTORS: vscode.DocumentSelector = [
  { scheme: 'file', language: 'javascript' },
  { scheme: 'file', language: 'javascriptreact' },
  { scheme: 'file', language: 'typescript' },
  { scheme: 'file', language: 'typescriptreact' },
  { scheme: 'file', language: 'vue' },
  { scheme: 'file', language: 'svelte' },
  { scheme: 'file', language: 'html' }
];

let current: LensScanResult | undefined;
let currentConfig: LensConfig | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('i18ntk Lens');
  const diagnostics = vscode.languages.createDiagnosticCollection('i18ntk Lens');
  const codeLensProvider = new LensCodeLensProvider();

  context.subscriptions.push(
    output,
    diagnostics,
    vscode.languages.registerHoverProvider(SELECTORS, new LensHoverProvider()),
    vscode.languages.registerCodeLensProvider(SELECTORS, codeLensProvider),
    vscode.commands.registerCommand('i18ntkLens.scan', async () => {
      try {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) {
          vscode.window.showWarningMessage('i18ntk Lens: open a workspace first.');
          return;
        }
        currentConfig = await resolveConfig(root);
        current = await scanWorkspace(currentConfig, (vscode.workspace.getConfiguration('i18ntkLens').get('customWrappers') ?? []) as string[]);
        updateDiagnostics(diagnostics, current);
        codeLensProvider.refresh();
        vscode.window.showInformationMessage(`i18ntk Lens scan complete: ${current.locales.length} locales, ${current.missing.length} missing key usages, ${current.unused.length} unused keys.`);
      } catch (error) {
        output.appendLine(error instanceof Error ? error.stack ?? error.message : String(error));
        vscode.window.showErrorMessage(`i18ntk Lens: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
    vscode.commands.registerCommand('i18ntkLens.openKeyInLocaleFiles', async (key?: string) => {
      const actualKey = key ?? await vscode.window.showInputBox({ title: 'Translation key to open' });
      if (!actualKey || !current) return;
      const files = current.keyFiles[actualKey] ?? [];
      if (files.length === 0) {
        vscode.window.showWarningMessage(`i18ntk Lens: key "${actualKey}" was not found in locale files.`);
        return;
      }
      for (const file of files.slice(0, 8)) {
        await vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
      }
    }),
    vscode.workspace.onDidSaveTextDocument(async () => {
      if (currentConfig) {
        current = await scanWorkspace(currentConfig, (vscode.workspace.getConfiguration('i18ntkLens').get('customWrappers') ?? []) as string[]);
        updateDiagnostics(diagnostics, current);
        codeLensProvider.refresh();
      }
    }),
    vscode.commands.registerCommand('i18ntkLens.openSettings', () => {
      LensSettingsPanel.open(context);
    })
  );

  vscode.commands.executeCommand('i18ntkLens.scan');
}

export function deactivate(): void {}

class LensHoverProvider implements vscode.HoverProvider {
  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
    const match = findTranslationKeyAt(document.getText(), document.offsetAt(position), (vscode.workspace.getConfiguration('i18ntkLens').get('customWrappers') ?? []) as string[]);
    if (!match || !current) return undefined;
    const markdown = new vscode.MarkdownString(undefined, true);
    markdown.appendMarkdown(`**i18ntk Lens: ${escapeMarkdown(match.key)}**\n\n`);
    markdown.appendMarkdown('| Locale | Value |\n|---|---|\n');
    for (const locale of current.locales) {
      markdown.appendMarkdown(`| ${escapeMarkdown(locale)} | ${escapeMarkdown(current.keyValues[locale]?.[match.key] ?? 'Missing')} |\n`);
    }
    const missing = current.locales.filter((locale) => current?.keyValues[locale]?.[match.key] === undefined);
    if (missing.length) markdown.appendMarkdown(`\nMissing: ${missing.map(escapeMarkdown).join(', ')}\n`);
    return new vscode.Hover(markdown);
  }
}

class LensCodeLensProvider implements vscode.CodeLensProvider {
  private readonly emitter = new vscode.EventEmitter();
  readonly onDidChangeCodeLenses = this.emitter.event;

  refresh(): void {
    this.emitter.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
    if (!current) return [];
    return findTranslationKeys(document.getText(), (vscode.workspace.getConfiguration('i18ntkLens').get('customWrappers') ?? []) as string[]).map((match) => {
      const missing = current?.locales.filter((locale) => current?.keyValues[locale]?.[match.key] === undefined) ?? [];
      const title = missing.length ? `i18ntk: missing ${missing.join(', ')}` : 'i18ntk: open key';
      return new vscode.CodeLens(
        new vscode.Range(match.range.startLine, 0, match.range.startLine, 0),
        { title, command: 'i18ntkLens.openKeyInLocaleFiles', arguments: [match.key] }
      );
    });
  }
}

async function resolveConfig(rootPath: string): Promise<LensConfig> {
  const cfg = vscode.workspace.getConfiguration('i18ntkLens');
  const configuredLocaleDir = cfg.get('localeDirectory', '');
  return {
    rootPath,
    localeDirectory: configuredLocaleDir ? path.resolve(rootPath, configuredLocaleDir) : await detectLocaleDirectory(rootPath),
    sourceLocale: cfg.get('sourceLocale', 'en'),
    maxScanFiles: cfg.get('maxScanFiles', 3000),
    exclude: cfg.get('exclude', ['node_modules', '.git', '.next', 'dist', 'build', 'coverage'])
  };
}

async function detectLocaleDirectory(rootPath: string): Promise<string> {
  for (const candidate of ['locales', 'i18n', 'translations', 'public/locales', 'src/locales']) {
    const fullPath = path.join(rootPath, candidate);
    try {
      const stat = await fs.promises.stat(fullPath);
      if (stat.isDirectory()) return fullPath;
    } catch {
      // Continue.
    }
  }
  return path.join(rootPath, 'locales');
}

function updateDiagnostics(collection: vscode.DiagnosticCollection, result: LensScanResult): void {
  collection.clear();
  const byFile = new Map<string, vscode.Diagnostic[]>();
  for (const missing of result.missing) {
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(missing.range.startLine, missing.range.startCharacter, missing.range.endLine, missing.range.endCharacter),
      `Missing translation for key "${missing.key}" in: ${missing.locales.join(', ')}`,
      vscode.DiagnosticSeverity.Warning
    );
    diagnostic.source = 'i18ntk Lens';
    byFile.set(missing.filePath, [...(byFile.get(missing.filePath) ?? []), diagnostic]);
  }
  for (const unused of result.unused) {
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 1),
      `Translation key "${unused.key}" appears unused.`,
      vscode.DiagnosticSeverity.Information
    );
    diagnostic.source = 'i18ntk Lens';
    byFile.set(unused.filePath, [...(byFile.get(unused.filePath) ?? []), diagnostic]);
  }
  for (const [filePath, diagnostics] of byFile) {
    collection.set(vscode.Uri.file(filePath), diagnostics);
  }
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&');
}

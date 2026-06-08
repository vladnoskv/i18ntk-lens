import * as vscode from 'vscode';
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderSettingsHtml } from './settingsHtmlRenderer';
import { getConfigValue, getSharedLensSettings, loadSharedConfig, saveSharedLensSettings } from '../sharedConfig';

const CONFIG_FILE = '.i18ntk-config';

export class LensSettingsPanel {
  private static panel: vscode.WebviewPanel | undefined;

  static open(context: vscode.ExtensionContext): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'i18ntkLensSettings',
      'i18ntk Lens Settings',
      { viewColumn: vscode.ViewColumn.One, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] }
    );
    this.panel = panel;
    panel.onDidDispose(() => { this.panel = undefined; }, null, context.subscriptions);
    panel.webview.onDidReceiveMessage(this.handleMessage, null, context.subscriptions);
    panel.webview.html = '<!DOCTYPE html><html><body>Loading...</body></html>';
    void this.render();
  }

  private static async getHtmlAsync(): Promise<string> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const shared = getSharedLensSettings(root ? await loadSharedConfig(root) : undefined);
    return renderSettingsHtml({
      localeDirectory: getConfigValue('i18ntkLens', 'localeDirectory', shared.localeDirectory, ''),
      sourceLocale: getConfigValue('i18ntkLens', 'sourceLocale', shared.sourceLocale, 'en'),
      extensionLanguage: getConfigValue('i18ntkLens', 'extensionLanguage', shared.extensionLanguage, 'auto'),
      scanOnStartup: getConfigValue('i18ntkLens', 'scanOnStartup', shared.scanOnStartup, false),
      autoScanOnSave: getConfigValue('i18ntkLens', 'autoScanOnSave', shared.autoScanOnSave, false),
      maxScanFiles: getConfigValue('i18ntkLens', 'maxScanFiles', shared.maxScanFiles, 1000),
      exclude: getConfigValue('i18ntkLens', 'exclude', shared.exclude, []),
      customWrappers: getConfigValue('i18ntkLens', 'customWrappers', shared.customWrappers, []),
      keyFormats: getConfigValue('i18ntkLens', 'keyFormats', shared.keyFormats, ['dot', 'snake']),
      nonce: createNonce(),
      sharedRoot: root
    });
  }

  private static async render(): Promise<void> {
    if (this.panel) {
      this.panel.webview.html = await this.getHtmlAsync();
    }
  }

  private static async handleMessage(message: any): Promise<void> {
    const config = vscode.workspace.getConfiguration('i18ntkLens');
    if (message.command === 'save' || message.command === 'saveAndScan') {
      const d = message.data;
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (root) {
        await saveSharedLensSettings(root, d);
      }
      await config.update('localeDirectory', d.localeDirectory, vscode.ConfigurationTarget.Workspace);
      await config.update('sourceLocale', d.sourceLocale, vscode.ConfigurationTarget.Workspace);
      await config.update('extensionLanguage', d.extensionLanguage, vscode.ConfigurationTarget.Workspace);
      await config.update('scanOnStartup', d.scanOnStartup, vscode.ConfigurationTarget.Workspace);
      await config.update('autoScanOnSave', d.autoScanOnSave, vscode.ConfigurationTarget.Workspace);
      await config.update('maxScanFiles', d.maxScanFiles, vscode.ConfigurationTarget.Workspace);
      await config.update('exclude', d.exclude, vscode.ConfigurationTarget.Workspace);
      await config.update('customWrappers', d.customWrappers, vscode.ConfigurationTarget.Workspace);
      await config.update('keyFormats', d.keyFormats?.length ? d.keyFormats : ['dot', 'snake'], vscode.ConfigurationTarget.Workspace);
      this.panel?.webview.postMessage({ command: 'saved' });
      if (message.command === 'saveAndScan') {
        await vscode.commands.executeCommand('i18ntkLens.scan');
      }
    }
    if (message.command === 'reset') {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const configPath = root ? path.join(root, CONFIG_FILE) : undefined;
      if (configPath) {
        const current = await loadSharedConfig(root!);
        if (current?.extensions && typeof current.extensions === 'object' && !Array.isArray(current.extensions)) {
          const exts = current.extensions as Record<string, unknown>;
          if (exts.lens && typeof exts.lens === 'object' && !Array.isArray(exts.lens)) {
            const lensSection = exts.lens as Record<string, unknown>;
            const lensKeys = ['localeDirectory', 'sourceLocale', 'extensionLanguage', 'scanOnStartup', 'autoScanOnSave', 'maxScanFiles', 'exclude', 'customWrappers', 'keyFormats'];
            for (const key of lensKeys) delete lensSection[key];
          }
        }
        try {
          await fs.writeFile(configPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
        } catch {
          // File not writable — VS Code settings still reset below.
        }
      }
      await config.update('localeDirectory', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('sourceLocale', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('extensionLanguage', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('scanOnStartup', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('autoScanOnSave', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('maxScanFiles', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('exclude', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('customWrappers', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('keyFormats', undefined, vscode.ConfigurationTarget.Workspace);
      if (this.panel) {
        this.panel.webview.html = await this.getHtmlAsync();
      }
    }
  }
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i += 1) nonce += chars[Math.floor(Math.random() * chars.length)];
  return nonce;
}

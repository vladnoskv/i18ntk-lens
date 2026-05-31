import * as vscode from 'vscode';
import { renderSettingsHtml } from './settingsHtmlRenderer';

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
    panel.webview.html = this.getHtml();
  }

  private static getHtml(): string {
    const config = vscode.workspace.getConfiguration('i18ntkLens');
    const localeDir = config.get('localeDirectory', '');
    const sourceLocale = config.get('sourceLocale', 'en');
    const maxScanFiles = config.get('maxScanFiles', 3000);
    const exclude = config.get('exclude', []) as string[];
    const customWrappers = config.get('customWrappers', []) as string[];
    const keyFormats = config.get('keyFormats', ['dot', 'snake']) as string[];
    return renderSettingsHtml({ localeDirectory: localeDir, sourceLocale, maxScanFiles, exclude, customWrappers, keyFormats, nonce: createNonce() });
  }

  private static async handleMessage(message: any): Promise<void> {
    const config = vscode.workspace.getConfiguration('i18ntkLens');
    if (message.command === 'save' || message.command === 'saveAndScan') {
      const d = message.data;
      await config.update('localeDirectory', d.localeDirectory, vscode.ConfigurationTarget.Workspace);
      await config.update('sourceLocale', d.sourceLocale, vscode.ConfigurationTarget.Workspace);
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
      await config.update('localeDirectory', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('sourceLocale', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('maxScanFiles', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('exclude', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('customWrappers', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('keyFormats', undefined, vscode.ConfigurationTarget.Workspace);
      if (this.panel) {
        this.panel.webview.html = this.getHtml();
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

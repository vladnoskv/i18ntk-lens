import * as vscode from 'vscode';

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
    const nonce = createNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${esca(nonce)}';">
  <title>i18ntk Lens Settings</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 16px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
    h2 { font-size: 14px; margin-top: 20px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-weight: 600; margin-bottom: 4px; }
    .field input[type="text"], .field input[type="number"] { width: 100%; max-width: 400px; padding: 6px 8px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; }
    .field input[type="text"]:focus, .field input[type="number"]:focus { outline: 1px solid var(--vscode-focusBorder); }
    .field .hint { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
    .list-editor { max-width: 400px; }
    .list-editor .row { display: flex; gap: 6px; margin-bottom: 4px; }
    .list-editor .row input { flex: 1; }
    .list-editor .row button { flex-shrink: 0; }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 6px 12px; border-radius: 3px; cursor: pointer; margin-right: 6px; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .status { margin-top: 16px; padding: 8px; border-radius: 3px; display: none; }
    .status.ok { display: block; background: var(--vscode-testing-iconPassed); color: #fff; }
    .status.error { display: block; background: var(--vscode-errorForeground); color: #fff; }
  </style>
</head>
<body>
  <h1>i18ntk Lens Settings</h1>

  <div class="field">
    <label for="localeDir">Locale Directory</label>
    <input type="text" id="localeDir" value="${esca(localeDir)}" placeholder="Auto-detect (locales, i18n, translations)">
    <div class="hint">Leave empty to auto-detect common locale folders.</div>
  </div>

  <div class="field">
    <label for="sourceLocale">Source Locale</label>
    <input type="text" id="sourceLocale" value="${esca(sourceLocale)}">
    <div class="hint">Default source language code (e.g. en).</div>
  </div>

  <div class="field">
    <label for="maxScanFiles">Max Scan Files</label>
    <input type="number" id="maxScanFiles" value="${maxScanFiles}" min="100" step="100">
    <div class="hint">Maximum number of source files to scan (min 100).</div>
  </div>

  <h2>Excluded Folders</h2>
  <div class="field">
    <div class="list-editor" id="excludeList">${exclude.map((v) => `<div class="row"><input type="text" value="${esca(v)}"><button onclick="this.parentElement.remove()">&#x2715;</button></div>`).join('')}</div>
    <button id="addExclude" class="secondary">+ Add Folder</button>
  </div>

  <h2>Custom Wrapper Functions</h2>
  <div class="field">
    <div class="list-editor" id="wrapperList">${customWrappers.map((v) => `<div class="row"><input type="text" value="${esca(v)}"><button onclick="this.parentElement.remove()">&#x2715;</button></div>`).join('')}</div>
    <button id="addWrapper" class="secondary">+ Add Wrapper</button>
    <div class="hint">Custom function names that wrap translation calls (e.g. tx, __, _t).</div>
  </div>

  <div style="margin-top: 24px;">
    <button id="save">Save Settings</button>
    <button id="reset" class="secondary">Reset to Defaults</button>
  </div>

  <div id="status" class="status"></div>

  <script nonce="${esca(nonce)}">
    const vsc = acquireVsCodeApi();
    document.getElementById('addExclude').addEventListener('click', () => {
      const div = document.createElement('div');
      div.className = 'row';
      div.innerHTML = '<input type="text" value=""><button onclick="this.parentElement.remove()">&#x2715;</button>';
      document.getElementById('excludeList').appendChild(div);
    });
    document.getElementById('addWrapper').addEventListener('click', () => {
      const div = document.createElement('div');
      div.className = 'row';
      div.innerHTML = '<input type="text" value=""><button onclick="this.parentElement.remove()">&#x2715;</button>';
      document.getElementById('wrapperList').appendChild(div);
    });
    document.getElementById('save').addEventListener('click', () => {
      const data = {
        localeDirectory: document.getElementById('localeDir').value,
        sourceLocale: document.getElementById('sourceLocale').value,
        maxScanFiles: parseInt(document.getElementById('maxScanFiles').value) || 3000,
        exclude: [...document.getElementById('excludeList').querySelectorAll('input')].map(e => e.value).filter(Boolean),
        customWrappers: [...document.getElementById('wrapperList').querySelectorAll('input')].map(e => e.value).filter(Boolean),
      };
      vsc.postMessage({ command: 'save', data });
    });
    document.getElementById('reset').addEventListener('click', () => {
      vsc.postMessage({ command: 'reset' });
    });
    window.addEventListener('message', (e) => {
      const status = document.getElementById('status');
      if (e.data.command === 'saved') {
        status.className = 'status ok';
        status.textContent = 'Settings saved. Re-scan to apply changes.';
        setTimeout(() => { status.className = 'status'; }, 3000);
      }
    });
  </script>
</body>
</html>`;
  }

  private static async handleMessage(message: any): Promise<void> {
    const config = vscode.workspace.getConfiguration('i18ntkLens');
    if (message.command === 'save') {
      const d = message.data;
      await config.update('localeDirectory', d.localeDirectory, vscode.ConfigurationTarget.Workspace);
      await config.update('sourceLocale', d.sourceLocale, vscode.ConfigurationTarget.Workspace);
      await config.update('maxScanFiles', d.maxScanFiles, vscode.ConfigurationTarget.Workspace);
      await config.update('exclude', d.exclude, vscode.ConfigurationTarget.Workspace);
      await config.update('customWrappers', d.customWrappers, vscode.ConfigurationTarget.Workspace);
      this.panel?.webview.postMessage({ command: 'saved' });
    }
    if (message.command === 'reset') {
      await config.update('localeDirectory', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('sourceLocale', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('maxScanFiles', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('exclude', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('customWrappers', undefined, vscode.ConfigurationTarget.Workspace);
      if (this.panel) {
        this.panel.webview.html = this.getHtml();
      }
    }
  }
}

function esca(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i += 1) nonce += chars[Math.floor(Math.random() * chars.length)];
  return nonce;
}

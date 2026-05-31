export interface LensSettingsViewModel {
  localeDirectory: string;
  sourceLocale: string;
  maxScanFiles: number;
  exclude: string[];
  customWrappers: string[];
  keyFormats: string[];
  nonce: string;
}

export function renderSettingsHtml(model: LensSettingsViewModel): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${escapeAttr(model.nonce)}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>i18ntk Lens Settings</title>
  <style>
    body { box-sizing: border-box; margin: 0; padding: 20px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    *, *::before, *::after { box-sizing: inherit; }
    header { border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 16px; padding-bottom: 12px; }
    h1 { font-size: 20px; margin: 0 0 6px; }
    h2 { font-size: 14px; margin: 22px 0 10px; }
    p { color: var(--vscode-descriptionForeground); margin: 0; line-height: 1.5; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
    .field { margin-bottom: 14px; }
    label { display: block; font-weight: 600; margin-bottom: 5px; }
    input { width: 100%; padding: 7px 8px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; }
    input[type="checkbox"] { width: auto; margin: 0; }
    input:focus { outline: 1px solid var(--vscode-focusBorder); }
    .hint { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px; line-height: 1.45; }
    .list-editor { display: grid; gap: 6px; max-width: 560px; }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
    .checks { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
    .check { display: inline-flex; align-items: center; gap: 6px; font-weight: 400; }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 7px 11px; border-radius: 3px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
    .status { margin-top: 14px; padding: 8px; border-radius: 3px; display: none; }
    .status.ok { display: block; background: var(--vscode-testing-iconPassed); color: #fff; }
  </style>
</head>
<body>
  <header>
    <h1>i18ntk Lens Settings</h1>
    <p>Configure inline translation hovers, CodeLens indicators, diagnostics, and source scanning for this workspace.</p>
  </header>

  <section class="grid">
    <div class="field">
      <label for="localeDir">Locale Directory</label>
      <input type="text" id="localeDir" value="${escapeAttr(model.localeDirectory)}" placeholder="Auto-detect">
      <div class="hint">Leave empty to detect locales, i18n, translations, public/locales, or src/locales.</div>
    </div>
    <div class="field">
      <label for="sourceLocale">Source Locale</label>
      <input type="text" id="sourceLocale" value="${escapeAttr(model.sourceLocale)}">
      <div class="hint">The locale treated as the source language.</div>
    </div>
    <div class="field">
      <label for="maxScanFiles">Max Scan Files</label>
      <input type="number" id="maxScanFiles" value="${model.maxScanFiles}" min="100" step="100">
      <div class="hint">Caps source scanning work for large repositories.</div>
    </div>
  </section>

  <h2>Excluded Folders</h2>
  <div class="list-editor" id="excludeList">${model.exclude.map((v) => row(v)).join('')}</div>
  <div class="actions"><button id="addExclude" class="secondary">Add Folder</button></div>

  <h2>Custom Wrapper Functions</h2>
  <div class="list-editor" id="wrapperList">${model.customWrappers.map((v) => row(v)).join('')}</div>
  <div class="hint">Add wrapper names such as tx, __, or _t. Lens also detects common namespace helpers such as useTranslations("news.page").</div>
  <div class="actions"><button id="addWrapper" class="secondary">Add Wrapper</button></div>

  <h2>Key Formats</h2>
  <div class="checks">
    <label class="check" for="keyFormatDot"><input type="checkbox" id="keyFormatDot" value="dot"${checked(model.keyFormats, 'dot')}> Dot keys</label>
    <label class="check" for="keyFormatSnake"><input type="checkbox" id="keyFormatSnake" value="snake"${checked(model.keyFormats, 'snake')}> Snake keys</label>
  </div>
  <div class="hint">Dot matches keys like news.page.title. Snake matches keys like news_page_title. Enable both when locale files and source code mix styles.</div>

  <div class="actions">
    <button id="save">Save Settings</button>
    <button id="reset" class="secondary">Reset to Defaults</button>
    <button id="scan" class="secondary">Save and Scan</button>
  </div>
  <div id="status" class="status"></div>

  <script nonce="${escapeAttr(model.nonce)}">
    const vsc = acquireVsCodeApi();
    function addRow(containerId, value = '') {
      const row = document.createElement('div');
      row.className = 'row';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = value;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'secondary';
      remove.dataset.removeRow = 'true';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => row.remove());
      row.append(input, remove);
      document.getElementById(containerId).appendChild(row);
    }
    function collect() {
      return {
        localeDirectory: document.getElementById('localeDir').value.trim(),
        sourceLocale: document.getElementById('sourceLocale').value.trim() || 'en',
        maxScanFiles: parseInt(document.getElementById('maxScanFiles').value, 10) || 3000,
        exclude: [...document.getElementById('excludeList').querySelectorAll('input')].map(e => e.value.trim()).filter(Boolean),
        customWrappers: [...document.getElementById('wrapperList').querySelectorAll('input')].map(e => e.value.trim()).filter(Boolean),
        keyFormats: [...document.querySelectorAll('input[id^="keyFormat"]:checked')].map(e => e.value),
      };
    }
    document.getElementById('addExclude').addEventListener('click', () => addRow('excludeList'));
    document.getElementById('addWrapper').addEventListener('click', () => addRow('wrapperList'));
    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-remove-row]');
      if (button) button.parentElement.remove();
    });
    document.getElementById('save').addEventListener('click', () => vsc.postMessage({ command: 'save', data: collect() }));
    document.getElementById('scan').addEventListener('click', () => vsc.postMessage({ command: 'saveAndScan', data: collect() }));
    document.getElementById('reset').addEventListener('click', () => vsc.postMessage({ command: 'reset' }));
    window.addEventListener('message', (e) => {
      if (e.data.command !== 'saved') return;
      const status = document.getElementById('status');
      status.className = 'status ok';
      status.textContent = 'Settings saved.';
      setTimeout(() => { status.className = 'status'; }, 3000);
    });
  </script>
</body>
</html>`;
}

function row(value: string): string {
  return `<div class="row"><input type="text" value="${escapeAttr(value)}"><button type="button" class="secondary" data-remove-row="true">Remove</button></div>`;
}

function checked(values: string[], value: string): string {
  return values.includes(value) ? ' checked' : '';
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

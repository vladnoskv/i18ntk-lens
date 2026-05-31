import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSettingsHtml } from '../../src/webview/settingsHtmlRenderer';

test('renderSettingsHtml escapes settings values and includes CSP nonce', () => {
  const html = renderSettingsHtml({
    localeDirectory: 'locales/"bad"',
    sourceLocale: 'en',
    maxScanFiles: 3000,
    exclude: ['node_modules', '<script>'],
    customWrappers: ['tx', '" onclick="alert(1)'],
    keyFormats: ['dot', 'snake'],
    nonce: 'abc123'
  });

  assert.match(html, /script-src 'nonce-abc123'/);
  assert.match(html, /locales\/&quot;bad&quot;/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&quot; onclick=&quot;alert\(1\)/);
  assert.match(html, /id="keyFormatDot"[^>]*checked/);
  assert.match(html, /id="keyFormatSnake"[^>]*checked/);
  assert.doesNotMatch(html, /value="locales\/"bad""/);
});

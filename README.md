# i18ntk Lens

![i18ntk Lens icon](media/icon.png)

Inline translation visibility for i18ntk projects. Lens helps you see translations, missing keys, unused keys, and source usage directly in the editor.

## Features

- **Hover translations**: hover over `t("key")`, `i18n.t("key")`, `translate("key")`, `$t("key")`, or configured custom wrappers to see locale values.
- **CodeLens indicators**: each detected key shows whether target locales are missing.
- **Missing key diagnostics**: warnings in source files when a key has no value in one or more locales.
- **Unused key diagnostics**: informational diagnostics for source-locale keys that appear unused.
- **Open key across files**: jump from a key to the locale files that contain it.
- **Settings webview**: manage locale directory, source locale, scan limits, exclusions, and custom wrappers.

## Quick Start

1. Open a project with locale files, such as `locales/en/common.json` and `locales/fr/common.json`.
2. Lens auto-scans when the extension activates.
3. Hover over any detected translation key to see values across locales.
4. Use CodeLens or `i18ntk Lens: Open Key in Locale Files` to jump to locale files.
5. Use `i18ntk Lens: Open Settings` to configure scanning and wrapper detection.

## Commands

| Command | Description |
|---|---|
| `i18ntk Lens: Scan Workspace` | Re-scan locale and source files. |
| `i18ntk Lens: Open Key in Locale Files` | Open locale files containing a given key. |
| `i18ntk Lens: Open Settings` | Open the Lens settings webview. |

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `i18ntkLens.localeDirectory` | string | `""` | Locale directory path. Empty means auto-detect. |
| `i18ntkLens.sourceLocale` | string | `"en"` | Source/default locale code. |
| `i18ntkLens.maxScanFiles` | number | `3000` | Maximum source files to scan. |
| `i18ntkLens.exclude` | array | `["node_modules", ".git", ".next", "dist", "build", "coverage"]` | Folders excluded from scans. |
| `i18ntkLens.customWrappers` | array | `[]` | Additional translation wrapper names, such as `tx`, `__`, or `_t`. |

## Supported Layouts

Lens auto-detects `locales/`, `i18n/`, `translations/`, `public/locales/`, and `src/locales/`.

Directory-per-locale:

```text
locales/en/common.json
locales/fr/common.json
```

Flat files:

```text
locales/en.json
locales/fr.json
```

Nested JSON keys are flattened to dot notation, such as `checkout.payment.title`.

## Privacy

i18ntk Lens reads workspace files locally. No data is sent anywhere. No telemetry is collected.

## License

MIT. See [LICENSE](./LICENSE).

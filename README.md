# i18ntk Lens

![i18ntk Lens icon](media/icon.png)

A lightweight local-first VS Code extension for inline i18ntk visibility: hover translations, CodeLens indicators, missing-key warnings, unused-key diagnostics, key navigation, and workspace settings.

i18ntk Lens is standalone. It does not add an Activity Bar container, so if i18ntk Workbench is installed too, Workbench remains the single i18ntk sidebar icon while Lens keeps providing inline editor feedback.

## Install

Install i18ntk Lens from the VS Code Marketplace.

For the full command-line workflow, install the CLI in your project:

```bash
npm install i18ntk
```

Requirements:

- VS Code `^1.90.0`
- Node.js `>=18.0.0`
- JSON locale files in a supported layout

## Quick Start

1. Open a project with locale files, for example `locales/en/common.json` and `locales/fr/common.json`.
2. Lens auto-scans when the extension activates.
3. Hover over a detected translation key to see values across locales.
4. Use CodeLens or `i18ntk Lens: Open Key in Locale Files` to jump to locale files.
5. Use `i18ntk Lens: Open Settings` to configure locale discovery, source locale, scan limits, exclusions, and custom wrappers.

## Features

- **Hover translations**: shows values for `t("key")`, `i18n.t("key")`, `translate("key")`, `$t("key")`, and configured custom wrappers.
- **CodeLens indicators**: shows whether target locales are missing for each detected key.
- **Missing key diagnostics**: warns in source files when a used key has no value in one or more locales.
- **Unused key diagnostics**: marks source-locale keys that appear unused.
- **Open key across files**: jumps from a source key to matching locale files.
- **Settings webview**: manages locale directory, source locale, scan limits, exclusions, and custom wrappers.
- **Inline-only UI**: no duplicate i18ntk Activity Bar icon when Workbench is installed.
- **Local-first behavior**: reads workspace files locally and sends no telemetry.

## Command Reference

| Command | What it does | Writes or changes |
| --- | --- | --- |
| `i18ntk Lens: Scan Workspace` | Re-scans locale and source files, then refreshes hovers, CodeLens, and diagnostics. | No file changes. |
| `i18ntk Lens: Open Key in Locale Files` | Opens locale files containing a given key. | No file changes. |
| `i18ntk Lens: Open Settings` | Opens the Lens settings webview. | Workspace settings when saved. |

## Settings

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `i18ntkLens.localeDirectory` | string | `""` | Locale directory path. Empty means auto-detect. |
| `i18ntkLens.sourceLocale` | string | `"en"` | Source/default locale code. |
| `i18ntkLens.maxScanFiles` | number | `3000` | Maximum source files to scan. |
| `i18ntkLens.exclude` | array | `["node_modules", ".git", ".next", "dist", "build", "coverage"]` | Folders excluded from scans. |
| `i18ntkLens.customWrappers` | array | `[]` | Additional translation wrapper names, such as `tx`, `__`, or `_t`. |

## Supported Layouts

Lens auto-detects:

- `locales/`
- `i18n/`
- `translations/`
- `public/locales/`
- `src/locales/`

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

Nested JSON keys are flattened to dot notation. For example, `checkout.payment.title` maps to deeply nested JSON.

## CLI Companion

Lens focuses on inline editor feedback. For setup, analysis, validation, usage reports, completion, summary output, and Auto Translate from the terminal, install the CLI:

```bash
npm install i18ntk
```

Common CLI commands:

```bash
npx i18ntk --help
npx i18ntk --command=analyze
npx i18ntk --command=validate
npx i18ntk --command=usage
npx i18ntk --command=summary
npx i18ntk-translate locales/en/common.json fr --report-stdout
```

Use i18ntk Workbench when you want the VS Code sidebar, reports, key management, setup flow, and CLI-backed Auto Translate from inside the editor.

## Workbench and Lens

- Install **i18ntk Lens** when you want fast inline hovers, CodeLens, warnings, and settings.
- Install **i18ntk Workbench** when you want the sidebar, reports, key management, setup flow, and Auto Translate entry points.
- Install both when you want the full sidebar plus inline editor feedback. Workbench owns the Activity Bar icon; Lens stays inline-only so the sidebar remains clean.

## Privacy

i18ntk Lens reads workspace files locally. No data is sent anywhere, and no telemetry is collected.

## License

MIT. See [LICENSE](./LICENSE).

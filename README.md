# i18ntk Lens

Inline translation visibility for [i18ntk](https://www.npmjs.com/package/i18ntk) projects — see translations, missing keys, and unused keys right in your editor.

## Features

- **Hover translations** — hover over `t("key")`, `i18n.t("key")`, `translate("key")`, or `$t("key")` to see values across all locales.
- **CodeLens indicators** — each detected translation key shows which target languages are missing.
- **Missing key diagnostics** — warnings in source files when a translation key has no value in one or more locales.
- **Unused key diagnostics** — informational warnings for locale keys that appear unused in source code.
- **Open key across files** — jump from any key to all locale files that contain it.

## Quick Start

1. Open a project with locale files (e.g. `locales/en/common.json`, `locales/fr/common.json`).
2. i18ntk Lens auto-scans on open. Hover over any `t("...")` call to see translations.
3. CodeLens lines appear above each key, showing missing locales.

## Commands

| Command | Description |
|---|---|
| `i18ntk Lens: Scan Workspace` | Manually re-scan locale and source files. |
| `i18ntk Lens: Open Key in Locale Files` | Open all locale files containing a given key. |

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `i18ntkLens.localeDirectory` | string | `""` | Locale directory path. Empty = auto-detect. |
| `i18ntkLens.sourceLocale` | string | `"en"` | Source/default locale code. |
| `i18ntkLens.maxScanFiles` | number | `3000` | Maximum source files to scan. |
| `i18ntkLens.exclude` | array | `["node_modules", ".git", ".next", "dist", "build", "coverage"]` | Folders excluded from scans. |

## Supported Layouts

Auto-detects: `locales/`, `i18n/`, `translations/`, `public/locales/`, `src/locales/`

Directory-per-locale:
```
locales/en/common.json
locales/fr/common.json
```

Flat files:
```
locales/en.json
locales/fr.json
```

Nested JSON keys are flattened to dot‑notation (e.g. `"checkout.payment.title"`).

## Privacy

i18ntk Lens is local-first. It reads workspace files locally. No data is sent anywhere. No telemetry.

## License

MIT — see [LICENSE](./LICENSE).

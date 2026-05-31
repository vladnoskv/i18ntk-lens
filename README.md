# i18ntk Lens

i18ntk Lens is a small, fast VS Code extension for inline translation visibility in `i18ntk` projects.

## Features

- Hover over `t("key")`, `i18n.t("key")`, `translate("key")`, or `$t("key")` to see locale values.
- CodeLens above detected keys shows missing target languages.
- Command to open a key in all locale files where it exists.
- Diagnostics warn when keys are missing in locale files or appear unused.

## Commands

- `i18ntk Lens: Scan Workspace`
- `i18ntk Lens: Open Key in Locale Files`

## Settings

- `i18ntkLens.localeDirectory`
- `i18ntkLens.sourceLocale`
- `i18ntkLens.maxScanFiles`
- `i18ntkLens.exclude`

## Privacy

i18ntk Lens is local-first. It reads workspace source and locale files locally and does not send data to remote services. It includes no telemetry.

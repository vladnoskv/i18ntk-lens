# i18ntk Lens

![i18ntk Lens icon](media/icon.png)

[![VS Code Marketplace](https://img.shields.io/badge/VS_Code-Lens-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=VladNoskov.i18ntk-lens)

i18ntk Lens adds fast inline translation visibility to VS Code. Hover values, CodeLens coverage hints, missing-key warnings, unused-key diagnostics, key navigation, and workspace settings — all close to your code. Lens is standalone and does not add an Activity Bar icon.

## Latest in 1.2.0

- **JSX Component Detection**: `<Trans i18nKey>`, `<FormattedMessage id>`, `<FormattedMessage defaultMessage>`, `<t message>`, `<Translate id>` detected
- **Astro + ESM Support**: `.astro`, `.mdx`, `.mjs`, `.mts`, `.cjs`, `.cts`, `.rs` file scanning
- **Astro Language Support**: hover and CodeLens on `astro` language files
- **Framework Activation**: activates on `app/i18n`, `content/locales`, `lang`, `messages` paths
- **Exclude Defaults**: `.nuxt`, `.output`, `.astro`, `.svelte-kit`, `.cache`, `__generated__`, `target`

## Features

### Inline Feedback
- **Translation Hovers** — hover `t('key')` to see values in every configured language
- **CodeLens** — per-key coverage indicators showing how many target languages have translations
- **Missing-Key Diagnostics** — keys used in source but absent from target locale files
- **Unused-Key Diagnostics** — keys in locale files with no source references (advisory)

### Key Navigation
- **`i18ntk Lens: Open Key in Locale Files`** — jump from `t('key')` usage to the definition in JSON
- Built-in scan from settings webview with custom wrapper support

### Scanner
- Detects built-in wrappers: `t()`, `$t()`, `i18n.t()`, `useI18n()`, `useTranslation()`, `translate()`, `tx()`
- Configurable custom wrappers for project-specific patterns
- Namespace helpers: `useTranslations("scope")` expands to scoped key matching
- Imported locale JSON object detection: `import en from './locales/en.json'`
- Dynamic template resolution from static values, arrays, and object maps
- Snake-case key format support alongside dot notation

### Diagnostics
- Auto-translate residual detection from CLI resume reports
- Client boundary warnings for `'use client'` + locale JSON imports
- Quick-fix: add intentionally unchanged keys to Auto Translate protection

## Settings

| Setting | Default | Description |
|---|---|---|
| `i18ntkLens.localeDirectory` | `./locales` | Locale files root |
| `i18ntkLens.sourceLocale` | `en` | Source language |
| `i18ntkLens.maxScanFiles` | `1000` | Max source files per scan |
| `i18ntkLens.exclude` | `[node_modules, dist, …]` | Excluded directories |
| `i18ntkLens.scanOnStartup` | `false` | Auto-scan on activation |
| `i18ntkLens.autoScanOnSave` | `false` | Auto-scan on file save |
| `i18ntkLens.keyFormats` | `["dot", "snake"]` | Key format conventions |
| `i18ntkLens.customWrappers` | `[]` | Additional wrapper function names |
| `i18ntkLens.extensionLanguage` | `follow` | Extension UI language |

## Commands

| Command | Description |
|---|---|
| `i18ntkLens.scanWorkspace` | Run workspace scan |
| `i18ntkLens.openSettings` | Open settings webview |
| `i18ntkLens.openKeyInLocaleFiles` | Navigate from key to locale definition |

## Previous Releases

See [CHANGELOG.md](./CHANGELOG.md) for full version history.

## Install

```bash
# VS Code Marketplace
# Search: i18ntk Lens by Vlad Noskov

# Or via CLI
code --install-extension VladNoskov.i18ntk-lens
```

## License

MIT. See [LICENSE](./LICENSE).

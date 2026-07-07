# Changelog

## 1.3.0 - 2026-07-07

### Added

- **Python/Go/Rust/Ruby/Java/PHP/Handlebars language selectors:** Added 6 new language IDs to hover, CodeLens, and CodeAction providers.
- **Expanded file extensions:** `.py`, `.pyx`, `.pyi`, `.go`, `.rb`, `.java`, `.php`, `.hbs` added to `SOURCE_EXTENSIONS` in `scanner.ts`.
- **Expanded KNOWN_WRAPPERS (9 → 18):** Added `$_`, `$tc`, `gettext`, `gettext_lazy`, `lazy_gettext`, `I18n.t`, `I18n.translate`, `I18n.l`, `I18n.localize`.
- **Expanded NAMESPACE_HELPERS (7 → 10):** Added `useTranslate` (Qwik), `useSpeak` (Qwik), `withTranslation` (react-i18next).
- **Attribute key detection:** Added `findAttributeKeys()` detecting `i18nKey=`, `t-key=`, `data-i18n=` attributes — integrated into `findTranslationKeys()`.
- **Configurable copy formatter detection:** `detectSuspectedCopyFormatters()` now accepts custom formatter names array, matching Workbench behavior.
- **Expanded locale directory detection:** Added `app/i18n`, `content/locales`, `messages`, `lang`, `config/locales`, `assets/i18n`, `locale` to auto-discovery candidates.

### Changed

- **Version bumped to 1.3.0** for multi-framework language and pattern support.

## 1.2.0 - 2026-07-04

### Added

- **Framework-specific file extensions:** Added `.astro`, `.mdx`, `.mjs`, `.mts`, `.cjs`, `.cts`, `.rs` to `SOURCE_EXTENSIONS`. Astro components, ESM modules, and Rust source files are now scanned for translation keys.
- **JSX Component Detection:** Added `findJsxComponentKeys()` to `scanner.ts` — detects `<Trans i18nKey>`, `<FormattedMessage id>`, `<FormattedMessage defaultMessage>`, `<t message>`, and `<Translate id>` JSX components.
- **Framework-specific activation events:** Lens now activates on `app/i18n`, `content/locales`, `lang`, `messages`, and i18n config file paths.
- **Framework-specific exclude defaults:** Added `.nuxt`, `.output`, `.astro`, `.svelte-kit`, `.cache`, `__generated__`, `target` to exclude defaults.

### Changed

- **Document selectors:** Added `astro` language ID for hover and CodeLens providers.
- **Exclude defaults (package.json):** Updated to match new framework-specific defaults.

## 1.1.6 - 2026-06-08

- Fixed an infinite runtime-load retry loop in `localization.ts` that caused redundant `require()` calls on every `t()` invocation when the i18ntk runtime was unavailable, degrading scan performance.
- Fixed `findCallsForName` in `scanner.ts` where an unterminated quoted string caused a `break` that aborted all subsequent wrapper-call matches in the same file; now skips only the malformed match and continues.
- Fixed `autoScanOnSave` so it works without a prior manual scan by auto-creating the scan configuration on first save.
- Fixed the settings webview "Reset to Defaults" action so it now clears shared `.i18ntk-config` values instead of leaving stale defaults that were reapplied on reload.
- Fixed `saveSharedLensSettings` so `sourceDir` and locale directory (`i18nDir`) are no longer conflated when saving.
- Cleared module-level state (`current`, `currentConfig`, `currentScan`, `currentCustomWrappers`) on deactivation to prevent stale data after extension reload.

## 1.1.5 - 2026-06-05

- Lens now follows the active VS Code display language when a shipped locale bundle exists, with a clean English fallback for unsupported languages.
- Added shared `.i18ntk-config` support under `extensions.lens`; existing VS Code settings still take precedence.
- Lens reads shared locale directory, source locale, scan scheduling, custom wrappers, and key format defaults from project config.
- The settings webview now opens with shared config values and writes extension-owned changes back to `.i18ntk-config`.

## 1.1.3 - 2026-06-02

- Kept Lens manual-by-default by disabling activation scans and save-triggered scans unless explicitly enabled.
- Added `i18ntkLens.scanOnStartup` and `i18ntkLens.autoScanOnSave` settings.
- Expanded the Lens settings webview with a Scan Scheduling section that explains the CPU and memory tradeoffs for automatic scans.
- Fixed overlapping Lens scans by reusing the in-flight scan.
- Reduced default scan breadth from 3000 to 1000 source files and skipped source files larger than 2 MB during usage scanning.

## 1.1.2 - 2026-06-02

- Added i18ntk-powered extension UI localization with English, Spanish, French, and German locale bundles under `src/i18ntk/locales`.
- Added the `i18ntkLens.extensionLanguage` setting so users can follow VS Code display language or choose an extension UI language explicitly.
- Localized Lens commands, notifications, settings UI copy, and extension webview labels through the i18ntk runtime wrapper.
- Added locale copy scripts so packaged builds include i18ntk locale assets.
- Added tests that verify language switching, interpolation, fallback behavior, locale key coverage, and placeholder parity for every extension UI locale.
- Bumped the packaged i18ntk dependency reference to `i18ntk-4.4.2.tgz`.

## 1.1.1 - 2026-06-02

- Removed generic function-call key extraction so ordinary app calls such as `get("next")`, `headers.get("etag")`, and `clearWaitlist("admin.panel")` are not reported as missing translation keys.
- Kept explicit translation wrappers, configured custom wrappers, namespace helpers, dynamic templates, and imported locale-object reads as supported usage signals.
- Documented that unused-key diagnostics are advisory and should not be used for bulk deletion without verification.
- Auto Translate residual reports from `i18ntk-reports/auto-translate/latest.json` are now surfaced as locale JSON diagnostics, with a quick fix to add intentionally unchanged keys to Auto Translate protection.

## 1.0.2 - 2026-05-31

- Added dynamic key resolution for static runtime candidates from string constants, string arrays, and iterator callbacks.
- Added namespace-scoped runtime detection for helpers such as `useTranslations("news.page")`.
- Added imported locale JSON object detection for reads such as `common.save`.
- Added configurable dot/snake key format detection and matching.
- Bumped package metadata for the 1.0.2 VSIX update.

## 1.0.0 - 2026-05-31

- First Marketplace-ready release.
- Polished launch documentation for inline translation visibility, setup, commands, settings, supported layouts, and privacy.
- Added a Lens test script with unit coverage for scanner behavior, settings HTML escaping, package scripts, and standalone inline-only manifest behavior.
- Documented that Lens does not add a second i18ntk Activity Bar icon when Workbench is installed.
- Added CLI companion guidance recommending `npm install i18ntk` for terminal workflows.
- Packaged extension for VS Code Marketplace distribution.

## 0.2.0 - 2026-05-31

- Bumped extension version to 0.2.0.
- Added activation for `i18ntk Lens: Open Settings`.
- Refined the settings webview with clearer sections, responsive layout, CSP-safe controls, Save and Scan, and custom wrapper management.
- Updated user-facing README documentation for commands, settings, layouts, and privacy.

## 0.1.0 - 2026-05-31

- Initial release.
- Hover translations for `t()`, `i18n.t()`, `translate()`, `$t()` patterns.
- CodeLens indicators showing missing target languages per key.
- Missing key and unused key diagnostics.
- Auto-scan on workspace open and on save.
- `i18ntk Lens: Open Key in Locale Files` command.
- JSON locale file discovery (flat and nested, directory-per-locale and flat-file layouts).
- Configuration: `localeDirectory`, `sourceLocale`, `maxScanFiles`, `exclude`.

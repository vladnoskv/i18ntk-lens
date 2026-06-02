# Changelog

## 1.0.3 - 2026-06-01

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

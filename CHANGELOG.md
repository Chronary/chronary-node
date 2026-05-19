# Changelog

All notable changes to `@chronary/sdk` will be documented in this file starting with the soft-launch release.

## 0.1.4 — 2026-05-19

- First OIDC + Sigstore-provenance release. Published via npm Trusted Publishing from `Chronary/chronary-node`; provenance badge visible on npmjs.com.

## 0.1.3 — 2026-05-19

- Bootstrap publish to npmjs.com as `@chronary/sdk` via a one-time classic-token path (npm has no Pending Publisher flow; see #688). Sigstore provenance is **not** attached to this version — see 0.1.4 for the first attested release.
- Add `"publishConfig": { "access": "public" }` so the scoped package ships unrestricted.
- Fix `repository.url` / `bugs.url` canonical casing (`Chronary/`).

## 0.1.2 — 2026-05-18

- Add `CONTRIBUTING.md` to the public mirror documenting that this repo is generated from a private monorepo; PRs are welcome as proof-of-concept but can't be merged directly. No behavioral change.

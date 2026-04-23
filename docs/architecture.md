# Architecture decision summary

## Chosen stack

- **Cloudflare Pages** for the public product surface
- **Cloudflare Pages Functions** for job creation, validation, status, and runner callback endpoints
- **Cloudflare KV** for lightweight job and result storage
- **GitHub Actions** as the isolated scan execution layer
- **Pinned AAF external dependency** for actual scanning

## Job flow

1. User submits a GitHub repo URL on the public page.
2. Pages Function validates URL structure and checks GitHub repo metadata.
3. Worker stores a `queued` job in KV.
4. Worker dispatches `.github/workflows/scan-job.yml` in this repo.
5. GitHub Actions downloads the target public repo archive into a temp directory.
6. Runner applies guardrails for extracted size, file count, and path depth.
7. Runner downloads and builds a pinned AAF version from the upstream repo.
8. Runner executes AAF in JSON and Markdown modes.
9. Runner sends a signed callback to the Worker.
10. Worker stores the completed report and exposes it to the result page.

## Why this is the safest MVP shape

- The browser is only the front door, never the scan engine.
- Cloudflare handles lightweight API work well, but not long-running scans.
- GitHub Actions gives isolated, disposable execution without making the static site do unsafe work.
- The target repo is downloaded as archive content and scanned as files, not executed.
- AAF remains a separate dependency boundary, so the existing local repo does not need any edits.
- KV is enough for first-pass job state without introducing database overhead before the product is validated.

## Intentionally deferred

- private repo auth and OAuth flows
- recurring scans and saved policies
- billing and upgrade flows
- multi-user accounts
- GitHub App installation flow
- organisation dashboards
- D1 or R2-backed long-term reporting stores
- background queue fan-out beyond GitHub Actions

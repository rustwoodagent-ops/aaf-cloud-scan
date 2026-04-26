# AAF Cloud Scan

Public-facing repo scan front end for **Agent Artifact Firewall (AAF)**.

This project is a **new, isolated product surface**. It does **not** modify or depend on the local `rustwoodagent-ops/agent-artifact-firewall` working tree.

## Product goal

Paste a public GitHub repository URL, submit a scan job, run AAF in an isolated GitHub Actions job, then return a report page with:

- scan status
- summary verdict
- severity and artifact-class summary
- findings list
- downloadable JSON and Markdown reports

## MVP stack

- **Frontend:** Cloudflare Pages static site (`public/`)
- **API:** Cloudflare Pages Functions (`functions/`)
- **Job state:** Cloudflare KV
- **Scan execution:** GitHub Actions workflow in this repo
- **Scanner dependency:** pinned external AAF commit, consumed as a read-only dependency

## Safe integration model

This repo treats AAF as an **external dependency**.

Current scaffold approach:

1. Worker validates a public GitHub repo URL.
2. Worker creates a job record in KV.
3. Worker dispatches a GitHub Actions workflow in this repo.
4. The workflow downloads the target repo archive without executing repo code.
5. The workflow downloads and builds AAF from an immutable pinned commit SHA.
6. The workflow runs AAF against the extracted repo contents.
7. The workflow signs a callback to the Worker with the result payload.
8. The Worker stores the result for the public status page.

## MVP guardrails

- public GitHub repos only
- strict GitHub URL validation
- repository metadata preflight via GitHub API
- repo size limit
- extracted size, file-count, and path-depth guardrails
- rate limiting by IP
- signed runner callbacks with HMAC, timestamp validation, and replay-window checks
- no in-browser scanning
- no arbitrary code execution from the scanned repo
- clear queued, running, completed, and failed states

## Planned next scan tier

- lightweight mode for very large repositories
- focus on high-value agent-facing artifacts first (`SKILL.md`, `AGENTS.md`, hooks, MCP configs, manifests, bootstrap scripts)
- intended to provide partial trust signal without requiring a full heavy repo extraction path

## Local structure

- `public/` - static Pages frontend
- `functions/` - Pages Functions API
- `.github/workflows/scan-job.yml` - isolated scan runner
- `scripts/` - runner guard and callback scripts
- `docs/` - architecture, MVP spec, scaffold plan

## Recommended remote repo name

- `rustwoodagent-ops/aaf-cloud-scan`

## Existing AAF repo status

The existing `rustwoodagent-ops/agent-artifact-firewall` repo is **reference-only** for this project and was left untouched.

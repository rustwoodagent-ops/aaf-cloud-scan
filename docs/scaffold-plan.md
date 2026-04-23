# Initial scaffold plan

## Folder structure

- `public/`
  - `index.html`
  - `job.html`
  - `styles.css`
  - `main.js`
  - `job.js`
  - `_headers`
- `functions/`
  - `_lib/`
    - `validation.js`
    - `github.js`
    - `jobs.js`
    - `security.js`
  - `api/jobs/index.js`
  - `api/jobs/[id].js`
  - `api/callback/[id].js`
- `.github/workflows/scan-job.yml`
- `scripts/`
  - `scan-guards.sh`
  - `build-summary.mjs`
  - `runner-callback.mjs`
  - `run-scan-job.sh`
- `wrangler.toml`
- `.dev.vars.example`
- `README.md`
- `docs/*.md`

## Major files

- `wrangler.toml` configures Pages output, KV bindings, and non-secret vars.
- `functions/api/jobs/index.js` creates jobs and dispatches the workflow.
- `functions/api/jobs/[id].js` returns job state.
- `functions/api/callback/[id].js` accepts signed runner callbacks.
- `scan-job.yml` runs AAF in GitHub Actions.
- frontend files provide the public submission and result UX.

## Environment variables and bindings

### Worker vars
- `PUBLIC_BASE_URL`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_WORKFLOW_FILE`
- `GITHUB_WORKFLOW_REF`
- `JOB_TTL_SECONDS`
- `MAX_REPO_SIZE_KB`
- `MAX_FILE_COUNT`
- `MAX_PATH_DEPTH`
- `MAX_EXTRACTED_SIZE_KB`
- `RATE_LIMIT_WINDOW_SECONDS`
- `RATE_LIMIT_MAX_REQUESTS`
- `CALLBACK_MAX_AGE_SECONDS`
- `CALLBACK_FUTURE_SKEW_SECONDS`

### Worker secrets
- `GITHUB_API_TOKEN`
- `SCAN_CALLBACK_SECRET`

### KV bindings
- `JOBS_KV`
- `RATE_LIMIT_KV`

### GitHub Actions secrets
- `SCAN_CALLBACK_SECRET`

## Deployment targets

- **Cloudflare Pages:** serves `public/` and `functions/`
- **GitHub repository:** hosts the frontend code and the isolated scan workflow

# MVP functional spec

## Homepage sections

1. **Hero**
   - headline: scan agent artifact repos before install
   - subhead explaining AAF as a trust-and-safety layer
   - single primary repo submission form
2. **What gets scanned**
   - skills, plugins, hooks, MCP configs, instruction packs
3. **How it works**
   - submit, queue, scan, review
4. **Guardrails**
   - public repos only, rate limits, timeout, no repo code execution
5. **Result promise**
   - verdict, score, flagged classes, findings, downloadable report

## Form fields

- `repoUrl` (required)
  - HTTPS GitHub repo URL only
  - owner/repo root only

## Request flow

1. User submits repo URL.
2. API validates URL syntax and normalizes owner/repo.
3. API fetches GitHub repo metadata.
4. API rejects private, oversized, disabled, or malformed targets.
5. API creates a `queued` job and dispatches a workflow.
6. Frontend redirects to `job.html?id=<jobId>`.
7. Result page polls job status until terminal state.

## Job lifecycle

- `queued`
- `running`
- `completed`
- `failed`

## Result page contents

- repo name and submitted URL
- current job state
- verdict badge (`ALLOW`, `REVIEW`, `BLOCK`)
- score
- findings count
- severity summary
- artifact class summary
- findings list with rule, severity, path, explanation, recommendation
- download buttons for JSON and Markdown reports
- failure details when the scan fails cleanly

## Error states

- invalid GitHub URL
- non-root GitHub URL pasted
- repo not found
- private repo not supported in MVP
- repo exceeds size limits
- rate limit exceeded
- workflow dispatch failed
- runner timeout or callback failure
- result unavailable or expired

## Abuse controls

- strict GitHub-only URL validation
- only public repos supported
- IP-based submission rate limiting
- GitHub metadata preflight before dispatch
- repo size threshold before queueing
- extracted file-count and path-depth checks in runner
- signed callback secret between runner and Worker
- deterministic file analysis only, no repo code execution
- explicit terminal timeout/failure messaging

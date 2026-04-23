import { getNumericEnv } from './validation.js';

function jobKey(jobId) {
  return `job:${jobId}`;
}

export function createJobRecord({ repoUrl, owner, repo }) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    status: 'queued',
    repoUrl,
    owner,
    repo,
    createdAt: now,
    updatedAt: now,
    runner: {},
    result: null,
    error: null
  };
}

export async function putJob(env, job) {
  const ttl = getNumericEnv(env, 'JOB_TTL_SECONDS', 604800);
  await env.JOBS_KV.put(jobKey(job.id), JSON.stringify(job), { expirationTtl: ttl });
  return job;
}

export async function getJob(env, jobId) {
  const raw = await env.JOBS_KV.get(jobKey(jobId));
  return raw ? JSON.parse(raw) : null;
}

export async function updateJob(env, jobId, patch) {
  const current = await getJob(env, jobId);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    runner: { ...(current.runner || {}), ...(patch.runner || {}) },
    updatedAt: new Date().toISOString()
  };
  await putJob(env, next);
  return next;
}

export function deriveResult(reportJson, reportMarkdown = '') {
  const findings = Array.isArray(reportJson?.findings) ? reportJson.findings : [];
  const artifacts = Array.isArray(reportJson?.artifacts) ? reportJson.artifacts : [];

  const severitySummary = findings.reduce((acc, finding) => {
    const key = String(finding.severity || 'unknown').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const artifactClasses = [...new Set(artifacts.map((artifact) => artifact.type).filter(Boolean))].sort();

  return {
    verdict: reportJson?.decision || '--',
    score: reportJson?.score ?? null,
    findingsCount: reportJson?.findings_count ?? findings.length,
    severitySummary,
    artifactClasses,
    reportJson,
    reportMarkdown
  };
}

import { dispatchScanWorkflow, getPublicRepoMetadata } from '../../_lib/github.js';
import { createJobRecord, putJob, updateJob } from '../../_lib/jobs.js';
import { enforceRateLimit, jsonResponse } from '../../_lib/security.js';
import { normalizeGitHubRepoUrl } from '../../_lib/validation.js';

export async function onRequestPost(context) {
  let job = null;

  try {
    await enforceRateLimit(context.request, context.env);

    const body = await context.request.json().catch(() => ({}));
    const normalized = normalizeGitHubRepoUrl(body.repoUrl);
    const repoMeta = await getPublicRepoMetadata(normalized.owner, normalized.repo, context.env);

    job = createJobRecord({
      repoUrl: repoMeta.repoUrl,
      owner: repoMeta.owner,
      repo: repoMeta.repo
    });

    await putJob(context.env, job);

    const callbackBase = context.env.PUBLIC_BASE_URL || new URL(context.request.url).origin;
    const callbackUrl = `${callbackBase}/api/callback/${job.id}`;

    await dispatchScanWorkflow({
      env: context.env,
      callbackUrl,
      job,
      repoMeta
    });

    return jsonResponse({
      ok: true,
      jobId: job.id,
      jobUrl: `/job.html?id=${job.id}`,
      statusUrl: `/api/jobs/${job.id}`,
      job
    }, 202);
  } catch (error) {
    if (job) {
      await updateJob(context.env, job.id, {
        status: 'failed',
        error: `Dispatch failed: ${error.message || 'unknown error'}`
      });
    }

    const message = error.message || 'Could not create scan job.';
    const status = /rate limit/i.test(message) ? 429 : 400;
    return jsonResponse({ error: message }, status);
  }
}

export function onRequestGet() {
  return jsonResponse({
    name: 'AAF Cloud Scan API',
    endpoints: {
      createJob: 'POST /api/jobs',
      getJob: 'GET /api/jobs/:id'
    }
  });
}

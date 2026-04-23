import { deriveResult, getJob, updateJob } from '../../_lib/jobs.js';
import { jsonResponse, verifyCallbackRequest } from '../../_lib/security.js';
import { assertSafeJobId } from '../../_lib/validation.js';

export async function onRequestPost(context) {
  try {
    const jobId = assertSafeJobId(context.params.id);
    const existing = await getJob(context.env, jobId);
    if (!existing) {
      return jsonResponse({ error: 'Scan job not found.' }, 404);
    }

    if (['completed', 'failed'].includes(existing.status)) {
      return jsonResponse({ error: `Scan job already finalized as ${existing.status}.` }, 409);
    }

    const rawBody = await context.request.text();
    const signature = context.request.headers.get('x-aaf-signature');
    const timestamp = context.request.headers.get('x-aaf-timestamp');
    const verification = await verifyCallbackRequest({
      body: rawBody,
      signatureHeader: signature,
      timestampHeader: timestamp,
      secret: context.env.SCAN_CALLBACK_SECRET,
      env: context.env,
      jobId
    });

    if (!verification.ok) {
      return jsonResponse({ error: verification.error }, verification.status);
    }

    const payload = JSON.parse(rawBody);
    if (!['running', 'completed', 'failed'].includes(payload.status)) {
      return jsonResponse({ error: 'Invalid callback status.' }, 400);
    }

    const nextPatch = {
      status: payload.status || existing.status,
      runner: {
        startedAt: payload.startedAt,
        finishedAt: payload.finishedAt,
        logsUrl: payload.logsUrl,
        source: 'github-actions'
      },
      error: payload.error || null
    };

    if (payload.status === 'completed' && payload.reportJson) {
      nextPatch.result = deriveResult(payload.reportJson, payload.reportMarkdown || '');
    }

    const job = await updateJob(context.env, jobId, nextPatch);
    return jsonResponse({ ok: true, job });
  } catch (error) {
    return jsonResponse({ error: error.message || 'Could not process callback.' }, 400);
  }
}

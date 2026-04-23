import { getJob } from '../../_lib/jobs.js';
import { jsonResponse } from '../../_lib/security.js';
import { assertSafeJobId } from '../../_lib/validation.js';

export async function onRequestGet(context) {
  try {
    const jobId = assertSafeJobId(context.params.id);
    const job = await getJob(context.env, jobId);

    if (!job) {
      return jsonResponse({ error: 'Scan job not found.' }, 404);
    }

    return jsonResponse({ ok: true, job });
  } catch (error) {
    return jsonResponse({ error: error.message || 'Could not fetch scan job.' }, 400);
  }
}

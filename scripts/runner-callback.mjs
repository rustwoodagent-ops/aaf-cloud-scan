import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const callbackUrl = process.env.CALLBACK_URL;
const secret = process.env.SCAN_CALLBACK_SECRET;
const status = process.env.JOB_STATUS;

if (!callbackUrl || !secret || !status) {
  console.error('CALLBACK_URL, SCAN_CALLBACK_SECRET, and JOB_STATUS are required.');
  process.exit(1);
}

const payload = {
  status,
  startedAt: process.env.RUN_STARTED_AT || null,
  finishedAt: ['completed', 'failed'].includes(status) ? new Date().toISOString() : null,
  logsUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null,
  error: process.env.ERROR_MESSAGE || null
};

const reportJsonPath = process.env.REPORT_JSON_PATH;
const reportMarkdownPath = process.env.REPORT_MARKDOWN_PATH;

if (reportJsonPath && existsSync(reportJsonPath)) {
  payload.reportJson = JSON.parse(readFileSync(reportJsonPath, 'utf8'));
}

if (reportMarkdownPath && existsSync(reportMarkdownPath)) {
  payload.reportMarkdown = readFileSync(reportMarkdownPath, 'utf8');
}

const timestamp = String(Math.floor(Date.now() / 1000));
const body = JSON.stringify(payload);
const signature = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;

const response = await fetch(callbackUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-aaf-signature': signature,
    'x-aaf-timestamp': timestamp
  },
  body
});

if (!response.ok) {
  console.error(`Callback failed with status ${response.status}`);
  process.exit(1);
}

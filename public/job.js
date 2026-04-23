const params = new URLSearchParams(window.location.search);
const jobId = params.get('id');

const statusBadge = document.querySelector('#job-status-badge');
const titleNode = document.querySelector('#job-title');
const metaNode = document.querySelector('#job-meta');
const scoreNode = document.querySelector('#score-value');
const verdictNode = document.querySelector('#verdict-value');
const findingsNode = document.querySelector('#findings-value');
const artifactClassesNode = document.querySelector('#artifact-classes');
const severityNode = document.querySelector('#severity-summary');
const findingsListNode = document.querySelector('#findings-list');
const runnerStateNode = document.querySelector('#runner-state');
const downloadJsonButton = document.querySelector('#download-json');
const downloadMarkdownButton = document.querySelector('#download-markdown');

let latestJob = null;
let pollHandle = null;

function badgeClassForStatus(status) {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'running') return 'warning';
  return 'neutral';
}

function badgeClassForSeverity(severity) {
  if (severity === 'critical' || severity === 'high') return 'danger';
  if (severity === 'medium') return 'warning';
  return 'neutral';
}

function createPill(label, type = 'neutral') {
  const span = document.createElement('span');
  span.className = `pill ${type}`;
  span.textContent = label;
  return span;
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderRunnerState(job) {
  runnerStateNode.innerHTML = '';
  const items = [
    `Job ID: ${job.id}`,
    `Status: ${job.status}`,
    `Created: ${job.createdAt || 'n/a'}`,
    `Updated: ${job.updatedAt || 'n/a'}`
  ];

  if (job.runner?.startedAt) items.push(`Runner started: ${job.runner.startedAt}`);
  if (job.runner?.finishedAt) items.push(`Runner finished: ${job.runner.finishedAt}`);
  if (job.runner?.logsUrl) items.push(`Logs: ${job.runner.logsUrl}`);
  if (job.error) items.push(`Error: ${job.error}`);

  items.forEach((value) => {
    const div = document.createElement('div');
    div.className = 'codeish';
    div.textContent = value;
    runnerStateNode.appendChild(div);
  });
}

function renderFindings(job) {
  findingsListNode.innerHTML = '';
  const findings = job.result?.reportJson?.findings || [];

  if (job.status !== 'completed') {
    findingsListNode.textContent = 'Waiting for scan results.';
    return;
  }

  if (!findings.length) {
    findingsListNode.textContent = 'No findings were reported.';
    return;
  }

  findings.forEach((finding) => {
    const article = document.createElement('article');
    article.className = 'finding';

    const heading = document.createElement('h3');
    heading.textContent = `${finding.rule_id} · ${finding.title}`;

    const meta = document.createElement('div');
    meta.className = 'finding-meta';
    meta.appendChild(createPill(finding.severity.toUpperCase(), badgeClassForSeverity(finding.severity)));
    meta.appendChild(createPill(finding.relative_path || 'unknown path'));
    if (finding.line) meta.appendChild(createPill(`line ${finding.line}`));

    const why = document.createElement('p');
    why.innerHTML = `<strong>Why it matters:</strong> ${finding.explanation}`;

    const recommendation = document.createElement('p');
    recommendation.innerHTML = `<strong>Recommendation:</strong> ${finding.recommendation}`;

    article.append(heading, meta, why, recommendation);

    if (finding.evidence) {
      const evidence = document.createElement('p');
      evidence.innerHTML = `<strong>Evidence:</strong> <span class="codeish">${finding.evidence}</span>`;
      article.appendChild(evidence);
    }

    findingsListNode.appendChild(article);
  });
}

function renderSeveritySummary(job) {
  severityNode.innerHTML = '';
  const entries = Object.entries(job.result?.severitySummary || {});

  if (!entries.length) {
    severityNode.textContent = 'Waiting for severity data.';
    return;
  }

  entries.forEach(([severity, count]) => {
    const row = document.createElement('div');
    row.appendChild(createPill(`${severity.toUpperCase()}: ${count}`, badgeClassForSeverity(severity)));
    severityNode.appendChild(row);
  });
}

function renderArtifactClasses(job) {
  artifactClassesNode.innerHTML = '';
  const artifactClasses = job.result?.artifactClasses || [];

  if (!artifactClasses.length) {
    artifactClassesNode.textContent = 'No artifact classes reported yet.';
    return;
  }

  artifactClasses.forEach((label) => artifactClassesNode.appendChild(createPill(label)));
}

function bindDownloads(job) {
  const jsonReport = job.result?.reportJson;
  const markdownReport = job.result?.reportMarkdown;
  downloadJsonButton.disabled = !jsonReport;
  downloadMarkdownButton.disabled = !markdownReport;

  downloadJsonButton.onclick = () => {
    if (!jsonReport) return;
    downloadBlob(`${job.owner}-${job.repo}-aaf-report.json`, JSON.stringify(jsonReport, null, 2), 'application/json');
  };

  downloadMarkdownButton.onclick = () => {
    if (!markdownReport) return;
    downloadBlob(`${job.owner}-${job.repo}-aaf-report.md`, markdownReport, 'text/markdown');
  };
}

function renderJob(job) {
  latestJob = job;
  statusBadge.className = `badge ${badgeClassForStatus(job.status)}`;
  statusBadge.textContent = job.status.toUpperCase();
  titleNode.textContent = `${job.owner}/${job.repo}`;
  metaNode.textContent = job.repoUrl;
  scoreNode.textContent = job.result?.score ?? '--';
  verdictNode.textContent = job.result?.verdict || '--';
  findingsNode.textContent = job.result?.findingsCount ?? '--';

  renderArtifactClasses(job);
  renderSeveritySummary(job);
  renderFindings(job);
  renderRunnerState(job);
  bindDownloads(job);

  if (job.status === 'failed' && job.error) {
    findingsListNode.textContent = job.error;
  }

  if (job.status === 'completed' || job.status === 'failed') {
    window.clearTimeout(pollHandle);
  }
}

async function fetchJob() {
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Could not fetch scan job.');
  }

  return payload.job;
}

async function pollJob() {
  try {
    const job = await fetchJob();
    renderJob(job);

    if (job.status !== 'completed' && job.status !== 'failed') {
      pollHandle = window.setTimeout(pollJob, 5000);
    }
  } catch (error) {
    statusBadge.textContent = 'ERROR';
    findingsListNode.textContent = error.message || 'Could not load job.';
  }
}

if (!jobId) {
  statusBadge.textContent = 'INVALID';
  findingsListNode.textContent = 'Missing job ID.';
} else {
  pollJob();
}

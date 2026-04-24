const form = document.querySelector('#scan-form');
const repoInput = document.querySelector('#repo-url');
const statusNode = document.querySelector('#form-status');

function setStatus(message) {
  if (statusNode) statusNode.textContent = message;
}

async function createJob(repoUrl) {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ repoUrl })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Could not start scan.');
  }

  return payload;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const repoUrl = repoInput?.value?.trim();

  if (!repoUrl) {
    setStatus('Paste a public GitHub repository URL to continue.');
    return;
  }

  setStatus('Starting repository scan…');

  try {
    const payload = await createJob(repoUrl);
    const destination = payload.jobUrl || `/job.html?id=${encodeURIComponent(payload.jobId)}`;
    window.location.assign(destination);
  } catch (error) {
    setStatus(error.message || 'Could not start scan.');
  }
});

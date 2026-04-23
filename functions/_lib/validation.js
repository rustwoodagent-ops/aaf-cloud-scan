const GITHUB_HOST = 'github.com';

export function normalizeGitHubRepoUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('A GitHub repository URL is required.');
  }

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Enter a valid HTTPS GitHub repository URL.');
  }

  if (url.protocol !== 'https:' || url.hostname !== GITHUB_HOST) {
    throw new Error('Only HTTPS GitHub repository URLs are supported.');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2) {
    throw new Error('Use the root repository URL only, for example https://github.com/owner/repo.');
  }

  const owner = parts[0];
  const rawRepo = parts[1];
  const repo = rawRepo.replace(/\.git$/i, '');

  if (!owner || !repo) {
    throw new Error('Could not determine the GitHub owner and repository name.');
  }

  return {
    owner,
    repo,
    repoUrl: `https://github.com/${owner}/${repo}`
  };
}

export function assertSafeJobId(jobId) {
  if (!/^[a-f0-9-]{8,}$/i.test(jobId || '')) {
    throw new Error('Invalid job ID.');
  }
  return jobId;
}

export function getNumericEnv(env, key, fallback) {
  const value = Number(env?.[key] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

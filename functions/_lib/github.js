import { getNumericEnv } from './validation.js';

const BASE_URL = 'https://api.github.com';

async function githubRequest(path, env, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('accept', 'application/vnd.github+json');
  headers.set('user-agent', 'aaf-cloud-scan');

  if (env?.GITHUB_API_TOKEN) {
    headers.set('authorization', `Bearer ${env.GITHUB_API_TOKEN}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  return response;
}

export async function getPublicRepoMetadata(owner, repo, env) {
  const response = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, env);

  if (response.status === 404) {
    throw new Error('Repository not found.');
  }

  if (!response.ok) {
    throw new Error('Could not read repository metadata from GitHub.');
  }

  const payload = await response.json();
  if (payload.private) {
    throw new Error('Private repositories are not supported in this MVP.');
  }
  if (payload.disabled || payload.archived) {
    throw new Error('Archived or disabled repositories are not supported in this MVP.');
  }

  const maxRepoSizeKb = getNumericEnv(env, 'MAX_REPO_SIZE_KB', 50000);
  if (Number(payload.size || 0) > maxRepoSizeKb) {
    throw new Error(`Repository exceeds the current size limit of ${maxRepoSizeKb} KB.`);
  }

  return {
    owner: payload.owner?.login || owner,
    repo: payload.name || repo,
    fullName: payload.full_name || `${owner}/${repo}`,
    repoUrl: payload.html_url || `https://github.com/${owner}/${repo}`,
    apiUrl: payload.url,
    defaultBranch: payload.default_branch || 'main',
    sizeKb: Number(payload.size || 0),
    description: payload.description || '',
    tarballApiUrl: `${BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tarball/${encodeURIComponent(payload.default_branch || 'main')}`
  };
}

export async function dispatchScanWorkflow({ env, callbackUrl, job, repoMeta }) {
  if (!env?.GITHUB_API_TOKEN) {
    throw new Error('GITHUB_API_TOKEN is required to dispatch scan workflows.');
  }

  const body = {
    ref: env.GITHUB_WORKFLOW_REF || 'main',
    inputs: {
      job_id: job.id,
      target_owner: repoMeta.owner,
      target_repo: repoMeta.repo,
      target_default_branch: repoMeta.defaultBranch,
      target_repo_url: repoMeta.repoUrl,
      callback_url: callbackUrl,
      max_file_count: String(getNumericEnv(env, 'MAX_FILE_COUNT', 12000)),
      max_path_depth: String(getNumericEnv(env, 'MAX_PATH_DEPTH', 12)),
      max_extracted_size_kb: String(getNumericEnv(env, 'MAX_EXTRACTED_SIZE_KB', 75000))
    }
  };

  const response = await githubRequest(
    `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/actions/workflows/${encodeURIComponent(env.GITHUB_WORKFLOW_FILE)}/dispatches`,
    env,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Workflow dispatch failed: ${text || response.status}`);
  }
}

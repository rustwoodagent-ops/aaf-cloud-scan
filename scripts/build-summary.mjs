import { readFileSync } from 'node:fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/build-summary.mjs <report.json>');
  process.exit(1);
}

const payload = JSON.parse(readFileSync(filePath, 'utf8'));
const findings = Array.isArray(payload.findings) ? payload.findings : [];
const artifacts = Array.isArray(payload.artifacts) ? payload.artifacts : [];

const severitySummary = findings.reduce((acc, finding) => {
  const key = String(finding.severity || 'unknown').toLowerCase();
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const artifactClasses = [...new Set(artifacts.map((artifact) => artifact.type).filter(Boolean))].sort();

process.stdout.write(JSON.stringify({
  verdict: payload.decision || '--',
  score: payload.score ?? null,
  findingsCount: payload.findings_count ?? findings.length,
  severitySummary,
  artifactClasses
}, null, 2));

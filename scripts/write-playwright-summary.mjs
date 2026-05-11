import { existsSync, readFileSync, appendFileSync } from 'node:fs';

const reportPath = process.argv[2] ?? 'test-results/playwright-results.json';
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

function write(markdown) {
  if (summaryPath) {
    appendFileSync(summaryPath, markdown);
    return;
  }

  console.log(markdown);
}

function escapeMarkdown(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('\n', '<br>');
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return '0.0s';
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function labelStatus(status) {
  switch (status) {
    case 'expected':
      return 'Passed';
    case 'unexpected':
      return 'Failed';
    case 'flaky':
      return 'Flaky';
    case 'skipped':
      return 'Skipped';
    case 'interrupted':
      return 'Interrupted';
    default:
      return status ? String(status) : 'Unknown';
  }
}

function collectTests(suite, fileName = '', titlePath = []) {
  if (Array.isArray(suite)) {
    return suite.flatMap(child => collectTests(child, fileName, titlePath));
  }

  const currentFile = suite.file || fileName;
  const currentPath = suite.title ? [...titlePath, suite.title] : titlePath;
  const rows = [];

  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const attempts = test.results ?? [];
      const duration = attempts.reduce((total, result) => total + (result.duration ?? 0), 0);
      const retries = attempts.filter(result => result.retry > 0).length;

      rows.push({
        file: currentFile,
        project: test.projectName,
        status: test.status,
        title: [...currentPath, spec.title].filter(Boolean).join(' > '),
        retries,
        duration,
      });
    }
  }

  for (const child of suite.suites ?? []) {
    rows.push(...collectTests(child, currentFile, currentPath));
  }

  return rows;
}

if (!existsSync(reportPath)) {
  write(`## Playwright Test Results\n\nNo Playwright JSON report was found at \`${reportPath}\`.\n`);
  process.exit(0);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const tests = collectTests(report.suites ?? {});
const counts = tests.reduce(
  (totals, test) => {
    totals[test.status] = (totals[test.status] ?? 0) + 1;
    return totals;
  },
  {},
);

const summary = [
  '## Playwright Test Results',
  '',
  `Total: ${tests.length}`,
  `Passed: ${counts.expected ?? 0}`,
  `Failed: ${counts.unexpected ?? 0}`,
  `Flaky: ${counts.flaky ?? 0}`,
  `Skipped: ${counts.skipped ?? 0}`,
  '',
  '| Project | Status | Test | File | Retries | Duration |',
  '| --- | --- | --- | --- | ---: | ---: |',
  ...tests.map(test =>
    [
      escapeMarkdown(test.project),
      escapeMarkdown(labelStatus(test.status)),
      escapeMarkdown(test.title),
      escapeMarkdown(test.file),
      String(test.retries),
      formatDuration(test.duration),
    ].join(' | '),
  ).map(row => `| ${row} |`),
  '',
].join('\n');

write(summary);

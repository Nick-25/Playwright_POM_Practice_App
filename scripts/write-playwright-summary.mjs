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

function totalDuration(tests) {
  return tests.reduce((total, test) => total + test.duration, 0);
}

function statusIcon(status) {
  switch (status) {
    case 'expected':
      return '✅';
    case 'unexpected':
      return '❌';
    case 'flaky':
      return '⚠️';
    case 'skipped':
      return '⏭️';
    case 'interrupted':
      return '⏹️';
    default:
      return '❔';
  }
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

function displayStatus(status) {
  return `${statusIcon(status)} ${labelStatus(status)}`;
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
    return groups;
  }, new Map());
}

function statusCounts(tests) {
  return tests.reduce(
    (totals, test) => {
      totals[test.status] = (totals[test.status] ?? 0) + 1;
      return totals;
    },
    {},
  );
}

function displayTitle(test) {
  const filePrefix = `${test.file} > `;
  return test.title.startsWith(filePrefix) ? test.title.slice(filePrefix.length) : test.title;
}

function statusSummary(tests) {
  const counts = statusCounts(tests);
  return [
    `${statusIcon('expected')} ${counts.expected ?? 0} passed`,
    `${statusIcon('unexpected')} ${counts.unexpected ?? 0} failed`,
    `${statusIcon('flaky')} ${counts.flaky ?? 0} flaky`,
    `${statusIcon('skipped')} ${counts.skipped ?? 0} skipped`,
  ].join(' | ');
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
const counts = statusCounts(tests);
const projects = [...groupBy(tests, test => test.project).entries()].sort(([left], [right]) =>
  left.localeCompare(right),
);
const problemTests = tests.filter(test => ['unexpected', 'flaky', 'interrupted'].includes(test.status));
const overallStatus = problemTests.length ? '⚠️ Needs attention' : '✅ Passed';

function overviewTable() {
  return [
    '| Result | Count |',
    '| --- | ---: |',
    `| 🧪 Total tests | ${tests.length} |`,
    `| ${statusIcon('expected')} Passed | ${counts.expected ?? 0} |`,
    `| ${statusIcon('unexpected')} Failed | ${counts.unexpected ?? 0} |`,
    `| ${statusIcon('flaky')} Flaky | ${counts.flaky ?? 0} |`,
    `| ${statusIcon('skipped')} Skipped | ${counts.skipped ?? 0} |`,
    `| ⏱️ Total duration | ${formatDuration(totalDuration(tests))} |`,
  ].join('\n');
}

function resultTable(testsToRender) {
  return [
    '| Status | Test | File | Retries | Duration |',
    '| --- | --- | --- | ---: | ---: |',
    ...testsToRender.map(test =>
      [
        escapeMarkdown(displayStatus(test.status)),
        escapeMarkdown(displayTitle(test)),
        escapeMarkdown(test.file),
        String(test.retries),
        formatDuration(test.duration),
      ].join(' | '),
    ).map(row => `| ${row} |`),
  ].join('\n');
}

const summary = [
  '## Playwright Test Results',
  '',
  `**Overall:** ${overallStatus}`,
  '',
  overviewTable(),
  '',
  ...(problemTests.length
    ? [
        '<details open>',
        '<summary><strong>⚠️ Failures, flaky tests, and interruptions</strong></summary>',
        '',
        resultTable(problemTests),
        '',
        '</details>',
        '',
      ]
    : ['✅ All tests passed without flakes.', '']),
  ...projects.flatMap(([project, projectTests]) => [
    '<details>',
    `<summary><strong>🌐 ${escapeMarkdown(project)}</strong> - ${escapeMarkdown(statusSummary(projectTests))} - ⏱️ ${formatDuration(totalDuration(projectTests))}</summary>`,
    '',
    resultTable(projectTests),
    '',
    '</details>',
    '',
  ]),
  '',
].join('\n');

write(summary);

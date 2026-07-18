#!/usr/bin/env node
// e2e/generate-report.mjs
// Reads test-results/results.json from Playwright and generates a rich
// Markdown summary report at test-results/REPORT.md

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resultsPath = resolve(__dirname, '..', 'test-results', 'results.json');
const outputPath = resolve(__dirname, '..', 'test-results', 'REPORT.md');

if (!existsSync(resultsPath)) {
  console.error('❌ test-results/results.json not found. Run "npm run test:e2e" first.');
  process.exit(1);
}

const results = JSON.parse(readFileSync(resultsPath, 'utf8'));

// ─── Aggregate stats ─────────────────────────────────────────────────────────
let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;
let totalFlaky = 0;
let totalDurationMs = 0;

const fileStats = {};
const failedTests = [];
const slowTests = [];

for (const suite of results.suites ?? []) {
  processSuite(suite, suite.title ?? 'Unknown File');
}

function processSuite(suite, fileName) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const testTitle = `${spec.title}`;
      const testFile = fileName.split(/[/\\]/).pop();
      const status = test.status;
      const durationMs = test.results?.reduce((sum, r) => sum + (r.duration ?? 0), 0) ?? 0;
      const retries = test.results?.length - 1 ?? 0;

      totalDurationMs += durationMs;

      if (!fileStats[testFile]) {
        fileStats[testFile] = { passed: 0, failed: 0, skipped: 0, flaky: 0, total: 0 };
      }

      fileStats[testFile].total++;

      if (status === 'expected') {
        totalPassed++;
        fileStats[testFile].passed++;
      } else if (status === 'unexpected') {
        totalFailed++;
        fileStats[testFile].failed++;
        failedTests.push({
          title: testTitle,
          file: testFile,
          error: test.results?.[test.results.length - 1]?.error?.message ?? 'Unknown error',
          durationMs,
        });
      } else if (status === 'skipped') {
        totalSkipped++;
        fileStats[testFile].skipped++;
      } else if (status === 'flaky') {
        totalFlaky++;
        fileStats[testFile].flaky++;
      }

      slowTests.push({ title: testTitle, file: testFile, durationMs });
    }
  }
  for (const child of suite.suites ?? []) {
    processSuite(child, fileName);
  }
}

const totalTests = totalPassed + totalFailed + totalSkipped + totalFlaky;
const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';
const totalDurationSec = (totalDurationMs / 1000).toFixed(1);
const avgDurationMs = totalTests > 0 ? (totalDurationMs / totalTests).toFixed(0) : 0;

// Sort slow tests (descending)
slowTests.sort((a, b) => b.durationMs - a.durationMs);
const top10Slow = slowTests.slice(0, 10);

// ─── Generate Markdown ───────────────────────────────────────────────────────
const now = new Date().toISOString();
const statusEmoji = totalFailed === 0 ? '✅' : totalFailed < 20 ? '⚠️' : '❌';

const incompleteRun = totalPassed === 0 && totalFailed === 0 && totalSkipped === totalTests;
const reportStatus = incompleteRun ? 'INCOMPLETE' : statusEmoji;

const lines = [
  `# ${reportStatus} Tagmate E2E Stress Test Report`,
  ``,
  `**Generated:** ${now}`,
  `**Suite:** Comprehensive ${totalTests}-test E2E Stress Suite`,
  ...(incompleteRun ? ['**Result:** Incomplete run — do not use this report as a test result.', ''] : []),
  ``,
  `---`,
  ``,
  `## Summary`,
  ``,
  `| Metric | Value |`,
  `|---|---|`,
  `| Total Tests | **${totalTests}** |`,
  `| ✅ Passed | **${totalPassed}** (${passRate}%) |`,
  `| ❌ Failed | **${totalFailed}** |`,
  `| ⏭️ Skipped | **${totalSkipped}** |`,
  `| 🔄 Flaky (retry passed) | **${totalFlaky}** |`,
  `| ⏱️ Total Duration | **${totalDurationSec}s** |`,
  `| Avg Test Duration | **${avgDurationMs}ms** |`,
  ``,
  `---`,
  ``,
  `## Results by Test File`,
  ``,
  `| Test File | Total | ✅ Pass | ❌ Fail | ⏭️ Skip | 🔄 Flaky |`,
  `|---|---|---|---|---|---|`,
  ...Object.entries(fileStats).map(([file, s]) =>
    `| \`${file}\` | ${s.total} | ${s.passed} | ${s.failed} | ${s.skipped} | ${s.flaky} |`
  ),
  ``,
  `---`,
  ``,
];

// ─── Failed Tests Section ──────────────────────────────────────────────────
if (failedTests.length > 0) {
  lines.push(`## ❌ Failed Tests (${failedTests.length})`);
  lines.push(``);
  for (const t of failedTests) {
    lines.push(`### \`${t.file}\` — ${t.title}`);
    lines.push(`- **Duration:** ${t.durationMs}ms`);
    lines.push(`- **Error:** \`${t.error.substring(0, 200).replace(/\n/g, ' ')}\``);
    lines.push(``);
  }
  lines.push(`---`);
  lines.push(``);
} else {
  lines.push(`## ✅ No Failed Tests — Perfect Run!`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
}

// ─── Top 10 Slowest Tests ─────────────────────────────────────────────────
lines.push(`## 🐌 Top 10 Slowest Tests`);
lines.push(``);
lines.push(`| Rank | Test | File | Duration |`);
lines.push(`|---|---|---|---|`);
for (let i = 0; i < top10Slow.length; i++) {
  const t = top10Slow[i];
  const sec = (t.durationMs / 1000).toFixed(2);
  lines.push(`| ${i + 1} | ${t.title.substring(0, 60)} | \`${t.file}\` | ${sec}s |`);
}
lines.push(``);
lines.push(`---`);
lines.push(``);

// ─── Coverage Matrix ─────────────────────────────────────────────────────────
lines.push(`## 📋 Coverage Matrix`);
lines.push(``);
lines.push(`| Feature Area | Spec File | Tests |`);
lines.push(`|---|---|---|`);
lines.push(`| Authentication | \`auth-matrix.spec.ts\` | ${fileStats['auth-matrix.spec.ts']?.total ?? 0} |`);
lines.push(`| Post Lifecycle | \`post-lifecycle.spec.ts\` | ${fileStats['post-lifecycle.spec.ts']?.total ?? 0} |`);
lines.push(`| Social Interactions (5×5 Matrix) | \`social-matrix.spec.ts\` | ${fileStats['social-matrix.spec.ts']?.total ?? 0} |`);
lines.push(`| Poll Voting | \`poll-voting.spec.ts\` | ${fileStats['poll-voting.spec.ts']?.total ?? 0} |`);
lines.push(`| Bulletin Board | \`bulletin-board.spec.ts\` | ${fileStats['bulletin-board.spec.ts']?.total ?? 0} |`);
lines.push(`| Direct Messages | \`dms.spec.ts\` | ${fileStats['dms.spec.ts']?.total ?? 0} |`);
lines.push(`| Group Chatroom | \`chatroom.spec.ts\` | ${fileStats['chatroom.spec.ts']?.total ?? 0} |`);
lines.push(`| Command Search | \`search.spec.ts\` | ${fileStats['search.spec.ts']?.total ?? 0} |`);
lines.push(`| Theme Switching | \`theme-switching.spec.ts\` | ${fileStats['theme-switching.spec.ts']?.total ?? 0} |`);
lines.push(`| Routing Guards | \`routing-guards.spec.ts\` | ${fileStats['routing-guards.spec.ts']?.total ?? 0} |`);
lines.push(`| Form Validation | \`form-validation.spec.ts\` | ${fileStats['form-validation.spec.ts']?.total ?? 0} |`);
lines.push(`| Notifications | \`notifications.spec.ts\` | ${fileStats['notifications.spec.ts']?.total ?? 0} |`);
lines.push(`| Quests & Reputation | \`quests-reputation.spec.ts\` | ${fileStats['quests-reputation.spec.ts']?.total ?? 0} |`);
lines.push(`| **TOTAL** | | **${totalTests}** |`);
lines.push(``);
lines.push(`---`);
lines.push(``);
lines.push(`## 🔍 Interactive HTML Report`);
lines.push(``);
lines.push(`Open the full interactive Playwright report:`);
lines.push(`\`\`\`bash`);
lines.push(`npx playwright show-report`);
lines.push(`\`\`\``);
lines.push(``);
lines.push(`---`);
lines.push(`*Report auto-generated by \`e2e/generate-report.mjs\`*`);

const markdown = lines.join('\n');
writeFileSync(outputPath, markdown, 'utf8');

console.log(`\n📊 REPORT GENERATED: test-results/REPORT.md`);
console.log(`   Total: ${totalTests} | Passed: ${totalPassed} | Failed: ${totalFailed} | Skipped: ${totalSkipped}`);
console.log(`   Pass Rate: ${passRate}% | Duration: ${totalDurationSec}s`);

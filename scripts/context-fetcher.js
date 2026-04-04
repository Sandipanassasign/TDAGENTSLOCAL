#!/usr/bin/env node
// context-fetcher.js — Auto-detect & fetch Jira/Confluence context before agent runs
//
// Usage:
//   node scripts/context-fetcher.js "BANK-4521 generate test cases"
//   node scripts/context-fetcher.js "confluence:112233445 review BRD"
//   node scripts/context-fetcher.js "BANK-4521 confluence:998877 generate test cases"
//   node scripts/context-fetcher.js "https://yourcompany.atlassian.net/wiki/spaces/QEA/pages/112233445/Page-Title"
//   node scripts/context-fetcher.js "BANK-4521 https://yourcompany.atlassian.net/wiki/spaces/QEA/pages/112233445"
//   node scripts/context-fetcher.js --defects    (refresh defect history)
//   node scripts/context-fetcher.js --sprint     (load current sprint stories)

require('dotenv').config({ path: './scripts/.env' });
const fs   = require('fs');
const path = require('path');
const { fetchIssue, fetchRecentDefects, fetchStoriesInSprint } = require('./jira-client');
const { fetchPageById, searchConfluence } = require('./confluence-client');

const CONTEXT_DIR = path.join(process.cwd(), 'context');
if (!fs.existsSync(CONTEXT_DIR)) fs.mkdirSync(CONTEXT_DIR, { recursive: true });

function write(filename, content) {
  const filepath = path.join(CONTEXT_DIR, filename);
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`  ✅ Written → context/${filename}`);
  return filepath;
}

function formatIssue(issue) {
  return `# Jira: ${issue.key} — ${issue.summary}

**Type:** ${issue.type} | **Status:** ${issue.status} | **Priority:** ${issue.priority}
**Reporter:** ${issue.reporter} | **Assignee:** ${issue.assignee}
**Sprint:** ${issue.sprint} | **Components:** ${issue.components || 'None'}
**Labels:** ${issue.labels || 'None'}

## Description
${issue.description || '_No description provided_'}

## Acceptance Criteria
${issue.acceptanceCriteria || '_No acceptance criteria specified — infer from description_'}

---
_Fetched: ${new Date().toISOString()}_
`;
}

function formatPage(page) {
  return `# Confluence: ${page.title}

**Space:** ${page.space} | **Version:** ${page.version} | **Last Updated:** ${page.lastUpdated}
**URL:** ${page.url}

## Content

${page.content}

---
_Fetched: ${new Date().toISOString()}_
`;
}

function formatDefects(defects) {
  const rows = defects.map(d =>
    `| ${d.key} | ${d.summary} | ${d.priority} | ${d.status} | ${d.resolution} | ${d.created} |`
  ).join('\n');
  return `# Recent Defects — ${process.env.JIRA_PROJECT_KEY}

| Key | Summary | Priority | Status | Resolution | Date |
|-----|---------|----------|--------|------------|------|
${rows}

---
_Fetched: ${new Date().toISOString()}_
`;
}

function formatSprint(stories) {
  const rows = stories.map(s =>
    `| ${s.key} | ${s.summary} | ${s.status} | ${s.priority} | ${s.assignee} |`
  ).join('\n');
  return `# Current Sprint Stories — ${process.env.JIRA_PROJECT_KEY}

| Key | Summary | Status | Priority | Assignee |
|-----|---------|--------|----------|----------|
${rows}

---
_Fetched: ${new Date().toISOString()}_
`;
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.join(' ');

  if (!input) {
    console.log('Usage: node scripts/context-fetcher.js "<your message or flags>"');
    console.log('');
    console.log('  "BANK-4521"                              → fetches Jira story');
    console.log('  "BANK-4521 confluence:112233"            → fetches story + Confluence page by ID');
    console.log('  "BANK-4521 https://…/pages/112233/Title" → fetches story + Confluence page by URL');
    console.log('  "https://…/pages/112233/Title"           → fetches Confluence page by full URL only');
    console.log('  --defects                                → refreshes defect history');
    console.log('  --sprint                                 → loads current sprint stories');
    process.exit(0);
  }

  const fetched = [];

  // --- Detect Jira issue key (e.g. BANK-1234, PROJ-99) ---
  const issueMatch = input.match(/\b([A-Z]{2,10}-\d+)\b/);
  if (issueMatch) {
    const key = issueMatch[1];
    console.log(`\nFetching Jira issue: ${key}...`);
    try {
      const issue = await fetchIssue(key);
      const content = formatIssue(issue);
      write('current-story.md', content);
      write(`${key}.md`, content); // Keep a named historical copy
      fetched.push(`Jira ${key}: ${issue.summary}`);
    } catch (e) {
      console.error(`  ❌ Jira fetch failed: ${e.message}`);
    }
  }

  // --- Detect Confluence page ID via "confluence:PAGEID" syntax OR full URL ---
  // Supports:  confluence:112233445
  //            https://company.atlassian.net/wiki/spaces/XX/pages/112233445/Title
  //            https://company.atlassian.net/wiki/pages/viewpage.action?pageId=112233445
  const confIdMatch  = input.match(/confluence:(\d+)/i);
  const confUrlMatch = input.match(/\/pages\/(\d+)/i)
                    || input.match(/[?&]pageId=(\d+)/i);
  const confMatch    = confIdMatch || confUrlMatch;
  if (confMatch) {
    const pageId = confMatch[1];
    console.log(`\nFetching Confluence page: ${pageId}...`);
    try {
      const page = await fetchPageById(pageId);
      const content = formatPage(page);
      const isBrd      = /brd|requirement|business requirement|functional spec/i.test(page.title);
      const isTestPlan = /test plan|test design|test strategy/i.test(page.title);
      if (isTestPlan) {
        write('test-plan.md', content);
      } else if (isBrd) {
        write('current-brd.md', content);
      } else {
        write('current-brd.md', content); // Default slot
      }
      write(`conf-${pageId}.md`, content);
      fetched.push(`Confluence: ${page.title}`);
    } catch (e) {
      console.error(`  ❌ Confluence fetch failed: ${e.message}`);
    }
  }

  // --- Smart search: if Jira issue found but no explicit Confluence ID, auto-search ---
  if (issueMatch && !confMatch) {
    const storyFile = path.join(CONTEXT_DIR, 'current-story.md');
    if (fs.existsSync(storyFile)) {
      const storyContent = fs.readFileSync(storyFile, 'utf8');
      const summaryMatch = storyContent.match(/^#[^—\n]+—\s*(.+)$/m);
      if (summaryMatch) {
        const searchTerm = summaryMatch[1].split(' ').slice(0, 4).join(' ');
        console.log(`\nSearching Confluence for related pages: "${searchTerm}"...`);
        try {
          const results = await searchConfluence(searchTerm);
          if (results.length > 0) {
            const list = results.map(r =>
              `- [${r.title}](${r.url}) (ID: ${r.id})\n  ${r.excerpt}...`
            ).join('\n\n');
            const relatedContent = `# Related Confluence Pages for ${issueMatch[1]}\n\n${list}\n\n---\n_To load a page fully, rerun with: confluence:<PAGE_ID>_\n\n_Fetched: ${new Date().toISOString()}_\n`;
            write('related-pages.md', relatedContent);
            console.log(`  Found ${results.length} related pages — see context/related-pages.md`);
          } else {
            console.log('  No related Confluence pages found.');
          }
        } catch (e) {
          // Non-fatal — search is best-effort
          console.log(`  Confluence search skipped: ${e.message}`);
        }
      }
    }
  }

  // --- Flag: refresh defect history ---
  if (input.includes('--defects') || input.toLowerCase().includes('defect')) {
    console.log('\nFetching recent defects...');
    try {
      const defects = await fetchRecentDefects(20);
      write('defect-history.md', formatDefects(defects));
      fetched.push(`${defects.length} recent defects`);
    } catch (e) {
      console.error(`  ❌ Defect fetch failed: ${e.message}`);
    }
  }

  // --- Flag: load current sprint ---
  if (input.includes('--sprint')) {
    console.log('\nFetching current sprint stories...');
    try {
      const stories = await fetchStoriesInSprint();
      write('current-sprint.md', formatSprint(stories));
      fetched.push(`${stories.length} sprint stories`);
    } catch (e) {
      console.error(`  ❌ Sprint fetch failed: ${e.message}`);
    }
  }

  if (fetched.length === 0 && !input.includes('--defects') && !input.includes('--sprint')) {
    console.log('\nNo Jira keys or Confluence IDs detected in input.');
    console.log('Use format:  BANK-1234  or  confluence:112233445');
    console.log('Or flags:    --defects  --sprint');
  } else if (fetched.length > 0) {
    console.log('\n--- Context ready ---');
    fetched.forEach(f => console.log('  ✔', f));
    console.log('\nIn Copilot Chat, attach these context files:');
    const storyExists  = fs.existsSync(path.join(CONTEXT_DIR, 'current-story.md'));
    const brdExists    = fs.existsSync(path.join(CONTEXT_DIR, 'current-brd.md'));
    const defectsExist = fs.existsSync(path.join(CONTEXT_DIR, 'defect-history.md'));
    const sprintExists = fs.existsSync(path.join(CONTEXT_DIR, 'current-sprint.md'));
    if (storyExists)  console.log('  📎 #context/current-story.md');
    if (brdExists)    console.log('  📎 #context/current-brd.md');
    if (defectsExist) console.log('  📎 #context/defect-history.md');
    if (sprintExists) console.log('  📎 #context/current-sprint.md');
  }
}

main().catch(e => {
  console.error('\nFatal error:', e.message);
  process.exit(1);
});

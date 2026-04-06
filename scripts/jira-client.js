// Reusable Jira API client — used by context-fetcher.js
require('dotenv').config({ path: './scripts/.env' });
const https = require('https');

function jiraRequest(path) {
  return new Promise((resolve, reject) => {
    const pat = process.env.JIRA_PAT;
    if (!pat) throw new Error('JIRA_PAT is not set in scripts/.env');

    const url = new URL(process.env.JIRA_BASE_URL + path);
    https.get({
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Jira parse error: ' + data.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

// Converts Atlassian Document Format nodes → plain text
function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  let out = '';
  if (node.type === 'text') out += node.text || '';
  if (node.type === 'hardBreak' || node.type === 'paragraph') out += '\n';
  if (node.type === 'bulletList' || node.type === 'orderedList') out += '\n';
  if (node.type === 'listItem') out += '- ';
  if (node.type === 'heading') out += '\n### ';
  if (node.content) node.content.forEach(child => { out += adfToText(child); });
  return out;
}

async function fetchIssue(issueKey) {
  const data = await jiraRequest(`/rest/api/3/issue/${issueKey}`);
  if (data.errorMessages) throw new Error(data.errorMessages.join(', '));
  const f = data.fields;
  return {
    key: data.key,
    type: f.issuetype?.name,
    status: f.status?.name,
    priority: f.priority?.name,
    summary: f.summary,
    description: adfToText(f.description),
    // Try common Acceptance Criteria field names
    acceptanceCriteria: adfToText(f.customfield_10016 || f.customfield_10014 || f.customfield_10028 || null),
    labels: (f.labels || []).join(', '),
    components: (f.components || []).map(c => c.name).join(', '),
    sprint: f.sprint?.name || f.customfield_10020?.[0]?.name || 'Not in sprint',
    storyPoints: f.story_points || f.customfield_10016 || '',
    reporter: f.reporter?.displayName,
    assignee: f.assignee?.displayName
  };
}

async function fetchRecentDefects(maxResults = 15) {
  const jql = encodeURIComponent(
    `project = ${process.env.JIRA_PROJECT_KEY} AND issuetype = Bug ORDER BY created DESC`
  );
  const data = await jiraRequest(
    `/rest/api/3/search?jql=${jql}&maxResults=${maxResults}&fields=summary,status,priority,description,resolution,created`
  );
  return (data.issues || []).map(i => ({
    key: i.key,
    summary: i.fields.summary,
    priority: i.fields.priority?.name,
    status: i.fields.status?.name,
    resolution: i.fields.resolution?.name || 'Unresolved',
    created: i.fields.created?.slice(0, 10)
  }));
}

async function fetchStoriesInSprint() {
  const jql = encodeURIComponent(
    `project = ${process.env.JIRA_PROJECT_KEY} AND issuetype = Story AND sprint in openSprints() ORDER BY priority ASC`
  );
  const data = await jiraRequest(
    `/rest/api/3/search?jql=${jql}&maxResults=20&fields=summary,status,priority,assignee`
  );
  return (data.issues || []).map(i => ({
    key: i.key,
    summary: i.fields.summary,
    status: i.fields.status?.name,
    priority: i.fields.priority?.name,
    assignee: i.fields.assignee?.displayName || 'Unassigned'
  }));
}

module.exports = { fetchIssue, fetchRecentDefects, fetchStoriesInSprint };

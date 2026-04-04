// Reusable Confluence API client
require('dotenv').config({ path: './scripts/.env' });
const https = require('https');

function confRequest(path) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(
      `${process.env.CONFLUENCE_EMAIL}:${process.env.CONFLUENCE_API_TOKEN}`
    ).toString('base64');

    const url = new URL(process.env.CONFLUENCE_BASE_URL + path);
    https.get({
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Confluence parse error: ' + data.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

// Strips Confluence storage format HTML → clean readable text
function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis, '\n### $1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gis, '\n- $1')
    .replace(/<tr[^>]*>(.*?)<\/tr>/gis, (_, row) => {
      const cells = [...row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
      return '| ' + cells.join(' | ') + ' |\n';
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchPageById(pageId) {
  const data = await confRequest(
    `/rest/api/content/${pageId}?expand=body.storage,version,space,ancestors`
  );
  if (data.statusCode === 404) throw new Error(`Confluence page ${pageId} not found`);
  return {
    id: data.id,
    title: data.title,
    space: data.space?.name,
    version: data.version?.number,
    lastUpdated: data.version?.when?.slice(0, 10),
    url: `${process.env.CONFLUENCE_BASE_URL}/pages/${data.id}`,
    content: htmlToText(data.body?.storage?.value)
  };
}

async function searchConfluence(query, spaceKey) {
  const resolvedSpace = spaceKey || process.env.CONFLUENCE_SPACE_KEY;
  // If space key is empty or '~all', search across all spaces the user has access to
  const spaceFilter = (!resolvedSpace || resolvedSpace === '~all')
    ? ''
    : ` AND space = "${resolvedSpace}"`;
  const cql = encodeURIComponent(
    `text ~ "${query}"${spaceFilter} ORDER BY lastmodified DESC`
  );
  const data = await confRequest(
    `/rest/api/content/search?cql=${cql}&limit=5&expand=body.storage`
  );
  return (data.results || []).map(p => ({
    id: p.id,
    title: p.title,
    url: `${process.env.CONFLUENCE_BASE_URL}/pages/${p.id}`,
    excerpt: htmlToText(p.body?.storage?.value).slice(0, 300)
  }));
}

module.exports = { fetchPageById, searchConfluence };

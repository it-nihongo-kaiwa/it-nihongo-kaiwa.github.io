export default async function handler(req, res) {
  const {
    GITHUB_TOKEN,
    REPO_OWNER,
    REPO_NAME,
    REPO_BRANCH = 'main',
    ALLOW_ORIGIN = '*',
  } = process.env;

  const headers = {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(204).end();
  }

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    return res.status(500).setHeader('Cache-Control', 'no-store').json({ error: 'Server not configured' });
  }

  const filePath = 'data/views.json';
  const ghBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;
  const ghHeaders = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'vercel-views-sync',
  };

  async function getFile() {
    const url = `${ghBase}?ref=${encodeURIComponent(REPO_BRANCH)}`;
    const r = await fetch(url, { headers: ghHeaders });
    if (r.status === 404) return { json: {}, sha: null };
    if (!r.ok) throw new Error(`GH_GET ${r.status}`);
    const body = await r.json();
    const content = Buffer.from(body.content || '', 'base64').toString('utf8');
    let json = {};
    try { json = JSON.parse(content || '{}'); } catch { json = {}; }
    return { json, sha: body.sha || null };
  }

  async function putFile(json, sha) {
    const content = Buffer.from(JSON.stringify(json, null, 2), 'utf8').toString('base64');
    const r = await fetch(ghBase, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'chore(views): update view count',
        content,
        branch: REPO_BRANCH,
        sha: sha || undefined,
        committer: { name: 'vercel-bot', email: 'bot@example.com' },
      }),
    });
    if (!r.ok) throw new Error(`GH_PUT ${r.status}`);
    return r.json();
  }

  function sanitizeId(id) {
    const s = String(id || '').trim();
    if (!/^[A-Za-z0-9_.-]+$/.test(s)) return null;
    return s;
  }

  try {
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);

    if (req.method === 'GET') {
      if (req.query.all === '1') {
        const { json } = await getFile();
        return res.status(200).json(json);
      }
      const id = sanitizeId(req.query.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { json } = await getFile();
      const count = Number(json[id] || 0);
      return res.status(200).json({ id, count });
    }

    if (req.method === 'POST') {
      const { id: rawId } = (req.body || {});
      const id = sanitizeId(rawId);
      if (!id) return res.status(400).json({ error: 'Invalid id' });

      for (let i = 0; i < 3; i++) {
        const { json, sha } = await getFile();
        const next = Number(json[id] || 0) + 1;
        json[id] = next;
        try {
          await putFile(json, sha);
          return res.status(200).json({ id, count: next });
        } catch (e) {
          if (i === 2) throw e;
          await new Promise(r => setTimeout(r, 250));
        }
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).setHeader('Cache-Control', 'no-store').json({ error: String(e) });
  }
}


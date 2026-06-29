const https = require('https');
const http = require('http');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || '';

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'catbox.moe',
        path: '/user/api.php',
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Content-Length': body.length
        }
      };
      const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => resolve(data.trim()));
      });
      proxyReq.on('error', reject);
      proxyReq.write(body);
      proxyReq.end();
    });

    if (!result.startsWith('http')) throw new Error('Upload failed: ' + result);
    res.status(200).send(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports.config = { api: { bodyParser: false } };

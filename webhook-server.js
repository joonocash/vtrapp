const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = 3002;

// GitHub webhook secret - ändra detta till något unikt!
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-this-secret-key';

app.use(express.json());

// Verify GitHub signature
function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

app.post('/webhook', (req, res) => {
  console.log('📥 Webhook received from GitHub');

  // Verify signature
  if (!verifySignature(req)) {
    console.error('❌ Invalid signature');
    return res.status(401).send('Invalid signature');
  }

  const event = req.headers['x-github-event'];

  // Only respond to push events on main branch
  if (event === 'push' && req.body.ref === 'refs/heads/main') {
    console.log('🚀 Push to main branch detected - deploying...');

    // Run update script
    exec('cd /home/joono/vtrapp && ./update.sh', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Deployment error:', error);
        return;
      }
      console.log('✅ Deployment output:', stdout);
      if (stderr) console.error('Stderr:', stderr);
    });

    res.status(200).send('Deployment started');
  } else {
    console.log(`ℹ️  Ignoring event: ${event}`);
    res.status(200).send('Event ignored');
  }
});

app.get('/health', (req, res) => {
  res.send('Webhook server is running');
});

app.listen(PORT, () => {
  console.log(`🎣 Webhook server listening on port ${PORT}`);
  console.log(`📍 Endpoint: http://localhost:${PORT}/webhook`);
});

const express = require('express');
const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Raw body parser for signature verification
router.use(express.raw({ type: '*/*' }));

function verifySignature(req) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET || '';
  const signature = req.headers['x-hub-signature-256'];
  if (!secret || !signature) return false;
  const digest = 'sha256=' + crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

router.post('/', asyncHandler(async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  const event = req.headers['x-github-event'];
  const delivery = req.headers['x-github-delivery'];
  const payload = JSON.parse(req.body.toString('utf8'));

  // Minimal normalized log
  const log = {
    provider: 'github',
    event,
    delivery,
    repository: payload.repository?.full_name,
    action: payload.action,
    ref: payload.ref,
    sender: payload.sender?.login,
  };

  console.log(JSON.stringify({ level: 'info', msg: 'github_webhook', ...log }));

  // TODO: map events to internal workflow triggers if needed
  res.json({ success: true, received: log });
}));

module.exports = router;



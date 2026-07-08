import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const APP_NAME = 'Enchant Forex';
const CODE_TTL_MS = 10 * 60 * 1000;

function secret() {
  return process.env.EMAIL_VERIFICATION_SECRET || process.env.JWT_SECRET || process.env.RESEND_API_KEY || 'Enchant Forex-test-secret';
}

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function tokenFor(email, code) {
  const payload = encode({ email, code, expiresAt: Date.now() + CODE_TTL_MS });
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token, email, code) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  const data = decode(payload);
  return data.email === email && data.code === code && Date.now() <= data.expiresAt;
}

function verificationHtml(code) {
  return `
    <div style="margin:0;padding:28px;background:#050608;color:#f8f3e5;font-family:Inter,Segoe UI,Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(246,215,119,.28);background:#090b0f;padding:28px;">
        <p style="margin:0 0 14px;color:#f6d777;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">${APP_NAME}</p>
        <h1 style="margin:0 0 12px;color:#f8dc77;font-size:28px;line-height:1.05;">Verify your email</h1>
        <p style="margin:0 0 18px;color:#d8caaa;font-size:15px;line-height:1.65;">Use this code to finish creating your Enchant Forex account.</p>
        <div style="margin:22px 0;padding:18px;border:1px solid rgba(246,215,119,.2);background:#050608;text-align:center;color:#f6d777;font-size:34px;font-weight:800;letter-spacing:.22em;">${code}</div>
        <p style="margin:22px 0 0;color:#8b95a7;font-size:12px;line-height:1.6;">This code expires in 10 minutes. Ignore this email if you did not request it.</p>
      </div>
    </div>
  `;
}

async function sendCodeEmail(email, code) {
  if (!process.env.RESEND_API_KEY) return { skipped: true };
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || `${APP_NAME} <notifications@enchantforex.com>`,
      to: [email],
      subject: 'Your Enchant Forex verification code',
      html: verificationHtml(code),
      ...(process.env.EMAIL_REPLY_TO || process.env.ADMIN_EMAIL ? { reply_to: process.env.EMAIL_REPLY_TO || process.env.ADMIN_EMAIL } : {})
    })
  });
  const payload = await emailResponse.json().catch(() => ({}));
  if (!emailResponse.ok) throw new Error(payload.message || 'Unable to send verification code.');
  return { id: payload.id };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { action = 'send', email = '', code = '', verificationId = '' } = request.body || {};
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return response.status(400).json({ message: 'Enter a valid email address.' });
  }

  if (action === 'verify') {
    try {
      if (!verifyToken(verificationId, normalizedEmail, String(code).trim())) {
        return response.status(400).json({ message: 'Invalid or expired verification code.' });
      }
      return response.status(200).json({ ok: true });
    } catch {
      return response.status(400).json({ message: 'Invalid or expired verification code.' });
    }
  }

  try {
    const generatedCode = String(randomInt(100000, 1000000));
    const result = await sendCodeEmail(normalizedEmail, generatedCode);
    return response.status(200).json({
      ok: true,
      verificationId: tokenFor(normalizedEmail, generatedCode),
      expiresIn: CODE_TTL_MS / 1000,
      ...(result.skipped || process.env.EMAIL_TEST_MODE === 'true' ? { testCode: generatedCode } : {})
    });
  } catch (error) {
    return response.status(400).json({ message: error.message || 'Unable to send verification code.' });
  }
}



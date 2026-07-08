const APP_NAME = 'Enchant Forex';

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function eventCopy(type, details = {}) {
  if (type === 'registration') {
    return {
      subject: 'Welcome to Enchant Forex',
      heading: 'Your Enchant Forex account is ready',
      body: 'Your member profile has been created successfully. You can now sign in to review plans, deposits, withdrawals, and account activity.',
      rows: [
        ['Country', details.country || 'Not provided'],
        ['Phone', details.phone || 'Not provided']
      ]
    };
  }

  if (type === 'deposit') {
    const approved = details.status === 'approved' || details.status === 'confirmed';
    return {
      subject: approved ? 'Deposit approved' : 'Deposit request received',
      heading: approved ? 'Your deposit has been approved' : 'Your deposit request is in review',
      body: approved ? 'Your deposit has been verified by the admin team. Your dashboard has been updated.' : 'We received your deposit request and placed it in the verification queue. You will see updates in your dashboard as the review progresses.',
      rows: [
        ['Plan', details.planName || details.asset || 'Deposit'],
        ['Amount', formatMoney(details.amountUsd || details.deposit)],
        ['Status', details.status || 'Pending verification']
      ]
    };
  }

  if (type === 'withdrawal') {
    const approved = details.status === 'approved' || details.status === 'paid' || details.status === 'processed';
    return {
      subject: approved ? 'Withdrawal approved' : 'Withdrawal request received',
      heading: approved ? 'Your withdrawal has been approved' : 'Your withdrawal request is in review',
      body: approved ? 'Your withdrawal has been approved by the admin team. Review your dashboard for the latest status.' : 'We received your withdrawal request. The request is now queued for verification and processing.',
      rows: [
        ['Amount', formatMoney(details.amountUsd || details.balance)],
        ['Asset', details.asset || 'Account balance'],
        ['Status', details.status || 'Pending review']
      ]
    };
  }

  return {
    subject: 'Enchant Forex notification',
    heading: 'Account update',
    body: 'There is a new update on your Enchant Forex account.',
    rows: []
  };
}

function htmlTemplate({ heading, body, rows }, user = {}) {
  const name = user.fullName || user.name || 'Member';
  const renderedRows = rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `
      <tr>
        <td style="padding:10px 0;color:#8b95a7;font-size:13px;">${label}</td>
        <td style="padding:10px 0;color:#f6d777;font-size:13px;text-align:right;font-weight:700;">${value}</td>
      </tr>
    `)
    .join('');

  return `
    <div style="margin:0;padding:28px;background:#050608;color:#f8f3e5;font-family:Inter,Segoe UI,Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(246,215,119,.28);background:#090b0f;padding:28px;">
        <p style="margin:0 0 14px;color:#f6d777;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">${APP_NAME}</p>
        <h1 style="margin:0 0 12px;color:#f8dc77;font-size:28px;line-height:1.05;">${heading}</h1>
        <p style="margin:0 0 18px;color:#d8caaa;font-size:15px;line-height:1.65;">Hi ${name},</p>
        <p style="margin:0 0 22px;color:#d8caaa;font-size:15px;line-height:1.65;">${body}</p>
        ${renderedRows ? `<table style="width:100%;border-top:1px solid rgba(246,215,119,.18);border-bottom:1px solid rgba(246,215,119,.18);border-collapse:collapse;margin:20px 0;">${renderedRows}</table>` : ''}
        <p style="margin:22px 0 0;color:#8b95a7;font-size:12px;line-height:1.6;">This message was sent automatically by ${APP_NAME}. Sign in to your dashboard for the latest account status.</p>
      </div>
    </div>
  `;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { type, user = {}, details = {} } = request.body || {};
  const recipient = user.email;
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return response.status(400).json({ message: 'A valid recipient email is required.' });
  }

  if (!process.env.RESEND_API_KEY) {
    return response.status(202).json({ ok: true, skipped: true, message: 'Email provider is not configured.' });
  }

  const copy = eventCopy(type, details);
  const from = process.env.EMAIL_FROM || `${APP_NAME} <notifications@enchantforex.com>`;
  const replyTo = process.env.EMAIL_REPLY_TO || process.env.ADMIN_EMAIL || undefined;
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: copy.subject,
      html: htmlTemplate(copy, user),
      ...(replyTo ? { reply_to: replyTo } : {})
    })
  });

  const payload = await emailResponse.json().catch(() => ({}));
  if (!emailResponse.ok) {
    return response.status(502).json({ message: payload.message || 'Unable to send email notification.' });
  }

  return response.status(200).json({ ok: true, id: payload.id });
}



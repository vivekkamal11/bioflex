const Razorpay = require('razorpay');
const { THEME_PRICES } = require('./lib/themes');

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const WA_TO_NUMBER = process.env.WA_TO_NUMBER || '919235290796';
const CALLMEBOT_APIKEY = process.env.CALLMEBOT_APIKEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

function extractSignature(body, signature) {
  if (!signature) return null;
  try {
    return Razorpay.validateWebhookSignature(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    return null;
  }
}

async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, disable_web_page_preview: true })
  });
  const body = await res.json();
  return !!(res.ok && body && body.ok);
}

async function sendWhatsApp(text) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(WA_TO_NUMBER)}&apikey=${encodeURIComponent(CALLMEBOT_APIKEY)}&text=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const body = await res.text();
  return body.includes('Message Sent') || !/Error/i.test(body);
}

async function notify(text) {
  const tgSent = await sendTelegram(text);
  if (tgSent) return 'telegram';
  if (CALLMEBOT_APIKEY) {
    const waSent = await sendWhatsApp(text);
    if (waSent) return 'whatsapp';
  }
  return null;
}

function configStatus() {
  const missing = [];
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) missing.push('RAZORPAY_WEBHOOK_SECRET');
  if (!process.env.TELEGRAM_BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN');
  if (!process.env.TELEGRAM_CHAT_ID) missing.push('TELEGRAM_CHAT_ID');
  return {
    telegram_token: !!process.env.TELEGRAM_BOT_TOKEN,
    telegram_chat_id: !!process.env.TELEGRAM_CHAT_ID,
    callmebot_apikey: !!process.env.CALLMEBOT_APIKEY,
    missing: missing
  };
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Webhook secret not configured. Set RAZORPAY_WEBHOOK_SECRET env var.' });
  }

  const signature = req.headers['x-razorpay-signature'];
  const bodyString = JSON.stringify(req.body);

  if (!extractSignature(bodyString, signature)) {
    return res.status(400).json({ message: 'Invalid signature / Fake Alert detected' });
  }

  const event = req.body.event;
  if (event !== 'payment.captured' && event !== 'order.paid') {
    return res.status(200).json({ status: 'ok', ignored: event });
  }

  const payment = req.body.payload && req.body.payload.payment && req.body.payload.payment.entity;
  const order = req.body.payload && req.body.payload.order && req.body.payload.order.entity;

  if (!payment) {
    return res.status(200).json({ status: 'ok', warning: 'No payment entity' });
  }

  const orderId = payment.order_id || (order && order.id) || '';
  const paymentId = payment.id || '';
  const amountPaid = Math.round((payment.amount || 0) / 100);
  const email = payment.email || (payment.notes && payment.notes.email) || '';
  const phone = payment.contact || (payment.notes && payment.notes.phone) || '';
  const notes = payment.notes || (order && order.notes) || {};
  const theme = notes.theme || 'Unknown Theme';
  const name = notes.name || payment.email || 'Customer';

  const expectedAmount = THEME_PRICES[theme];
  if (expectedAmount && amountPaid !== expectedAmount) {
    return res.status(200).json({
      status: 'mismatch',
      message: 'Paid amount does not match theme price',
      theme,
      amountPaid,
      expectedAmount
    });
  }

  const text = [
    'NEW ORDER - BioFlex Tech Agency',
    `Theme: ${theme}`,
    `Amount: Rs.${amountPaid}`,
    `Name: ${name}`,
    `Phone: ${phone || 'N/A'}`,
    `Email: ${email || 'N/A'}`,
    `Payment ID: ${paymentId}`,
    `Order ID: ${orderId}`
  ].join('\n');

  let notifyInfo;
  try {
    const via = await notify(text);
    if (via) {
      console.log('Notification sent via', via, 'for', paymentId);
      notifyInfo = { channel: via };
    } else {
      console.warn('No notification channel configured for', paymentId);
      notifyInfo = { channel: null, config: configStatus() };
    }
  } catch (err) {
    console.error('Notification failed:', err.message);
    notifyInfo = { channel: null, error: err.message };
  }

  console.log('VERIFIED PAYMENT SUCCESSFUL!', { paymentId, orderId, theme, amountPaid, name, phone, email });
  return res.status(200).json({ status: 'ok', notification: notifyInfo });
};

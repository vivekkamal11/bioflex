const Razorpay = require('razorpay');
const { THEME_PRICES } = require('./lib/themes');

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const WA_TO_NUMBER = process.env.WA_TO_NUMBER || '919235290796';
const CALLMEBOT_APIKEY = process.env.CALLMEBOT_APIKEY || '';

function extractSignature(body, signature) {
  if (!signature) return null;
  try {
    return Razorpay.validateWebhookSignature(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    return null;
  }
}

async function sendWhatsApp(text) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(WA_TO_NUMBER)}&apikey=${encodeURIComponent(CALLMEBOT_APIKEY)}&text=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const body = await res.text();
  return body.includes('Message Sent') || !/Error/i.test(body);
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

  try {
    await sendWhatsApp(text);
    console.log('WhatsApp notification sent for', paymentId);
  } catch (err) {
    console.error('WhatsApp notification failed:', err.message);
  }

  console.log('VERIFIED PAYMENT SUCCESSFUL!', { paymentId, orderId, theme, amountPaid, name, phone, email });
  return res.status(200).json({ status: 'ok' });
};

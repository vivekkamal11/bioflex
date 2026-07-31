const Razorpay = require('razorpay');

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Frontend me jo theme name hain, unka exact price mapping
const THEME_PRICES = {
  'Bio Link Basic': 199,
  'Clean White Card': 299,
  'Insta Creator Hub': 399,
  'Streamer Dark Vibe': 499,
  'Code & Portfolio': 699,
  'Glassmorphism Pro': 899,
  'Video Editor Grid': 1099,
  'Photographer Studio': 1299,
  'Corporate Bio Card': 1499,
  'Mini Agency Showcase': 1699,
  'Influencer VIP Page': 1899,
  'BioFlex Ultimate Suite': 1999
};

module.exports = async (req, res) => {
  // CORS Headers (Agar Vercel par api call me koi error aaye toh ye fix karega)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { themeId } = req.body;
    const amount = THEME_PRICES[themeId];

    if (!amount) {
      return res.status(400).json({ error: 'Invalid Theme ID / Theme Not Found' });
    }

    const options = {
      amount: amount * 100, // Paise me convert karna zaroori hai
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await instance.orders.create(options);
    
    // Frontend ko data bhejna
    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
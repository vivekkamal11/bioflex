const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const razorpaySignature = req.headers['x-razorpay-signature'];

  // Signature verify karna taaki koi fake request na bhej sake
  const shasum = crypto.createHmac('sha256', webhookSecret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');

  if (digest === razorpaySignature) {
    const event = req.body.event;

    // Jab order ka paisa mil jaye
    if (event === 'order.paid' || event === 'payment.captured') {
      const paymentData = req.body.payload.payment.entity;
      
      console.log('✅ VERIFIED PAYMENT SUCCESSFUL!', {
        paymentId: paymentData.id,
        orderId: paymentData.order_id,
        amount: paymentData.amount / 100,
        email: paymentData.email,
        phone: paymentData.contact
      });

      // Aap chaho toh yahan aage chalkar Email bhejne ka code daal sakte ho
    }

    res.status(200).json({ status: 'ok' });
  } else {
    // Agar hacker fake payment request bheje
    res.status(400).json({ message: 'Invalid signature / Fake Alert detected' });
  }
};
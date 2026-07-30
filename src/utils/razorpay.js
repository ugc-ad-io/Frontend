import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Load Razorpay's checkout SDK once, shared across callers.
let sdkPromise = null;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => { sdkPromise = null; reject(new Error('Could not load Razorpay. Check your connection.')); };
    document.body.appendChild(s);
  });
  return sdkPromise;
}

/**
 * Open Razorpay checkout for an order the BACKEND already created, then verify the
 * payment server-side (which is what actually credits the wallet).
 *
 * `order` is the /wallet/recharge response: { order_id, key_id, amount, currency }.
 * Only the public key_id ever reaches the browser — the secret stays on the server.
 *
 * Resolves with the /payments/verify response; rejects if the user cancels or it fails.
 */
export async function payWithRazorpay(order, { name, email, contact, description } = {}) {
  await loadRazorpay();

  if (!order?.key_id || !order?.order_id) {
    throw new Error('Payment gateway is not configured. Contact support.');
  }

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: Math.round(Number(order.amount || 0) * 100), // paise
      currency: order.currency || 'INR',
      name: 'UGCad.io',
      description: description || 'Wallet recharge',
      prefill: { name: name || '', email: email || '', contact: contact || '' },
      theme: { color: '#07074e' },
      // Razorpay calls this only on a successful payment.
      handler: async (res) => {
        try {
          const { data } = await axios.post(`${API}/payments/verify`, {
            razorpay_order_id: res.razorpay_order_id,
            razorpay_payment_id: res.razorpay_payment_id,
            razorpay_signature: res.razorpay_signature,
          });
          resolve(data);
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error('PAYMENT_CANCELLED')),
      },
    });

    rzp.on('payment.failed', (e) => reject(new Error(e?.error?.description || 'Payment failed')));
    rzp.open();
  });
}

export const isPaymentCancelled = (err) => err?.message === 'PAYMENT_CANCELLED';

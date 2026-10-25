import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from './kit';

// Wallet balance for the top-bar chip (boards M0 Home / Creators). null until known; a failed read stays hidden (never a fake 0).
export function useWalletBalance(skip = false) {
  const [balance, setBalance] = useState(null);
  useEffect(() => {
    if (skip) return undefined;
    let live = true;
    axios.get(`${API}/business/wallet`)
      .then((r) => { if (live) setBalance(Number(r.data?.available_balance || 0)); })
      .catch(() => {});
    return () => { live = false; };
  }, [skip]);
  return balance;
}

export default function WalletChip({ balance }) {
  const navigate = useNavigate();
  if (balance == null) return null;
  return (
    <button
      type="button"
      onClick={() => navigate('/dashboard/business/wallet')}
      aria-label={`Wallet balance ₹${balance.toLocaleString('en-IN')}`}
      style={{ height: 44, padding: 0, border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 12px', borderRadius: 999, background: '#ececfa', color: '#07074e', fontWeight: 700, fontSize: 12.5 }}>
        {`₹${balance.toLocaleString('en-IN')}`}
      </span>
    </button>
  );
}

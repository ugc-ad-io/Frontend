// select-creator hires even when the brand's wallet is short: the escrow exists but
// is NOT funded (funded === false). A missing flag means funded (older server).
export const WALLET_RECHARGE_PATH = '/dashboard/business/wallet?view=recharge';

export const hireUnfunded = (data) => data?.funded === false;

const inr = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export function hireUnfundedMessage(data, who = 'The creator') {
  const owed = Number(data?.amount_charged) || 0;
  return `${who} is hired, but your wallet is short. Add ${owed ? inr(owed) : 'funds'} to fund the escrow so work can start.`;
}

// Escrow wording for the normal success toast: the real amount the hire cost the brand.
export function escrowHeldText(data) {
  const held = Number(data?.amount_charged) || Number(data?.amount) || 0;
  return held ? `${inr(held)} held in escrow.` : 'Payment held in escrow.';
}

// Non-blocking prompt (never stops hiring): a toast with an "Add funds" action.
export function showUnfundedHire(toast, data, who, navigate) {
  toast.warning(hireUnfundedMessage(data, who), {
    duration: 12000,
    action: { label: 'Add funds', onClick: () => navigate(WALLET_RECHARGE_PATH) },
  });
}

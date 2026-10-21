// Brand wallet statement. The backend has no invoice / receipt download for brands (a recharge
// receipt is only emailed, GST invoices live in db.invoices for admins), so the one thing a
// brand can keep from the website is its own transaction history, exported here as CSV.
const HEAD = ['Date', 'Type', 'Reference', 'Direction', 'Amount (INR)', 'Status', 'Transaction ID'];

// Quote a cell, and neutralise spreadsheet formulas (=, +, -, @) that came from free text.
const cell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function walletStatementCsv(transactions = []) {
  const rows = transactions.map((t) => [
    t.date ? String(t.date).slice(0, 10) : '',
    t.type,
    t.reference,
    t.direction === 'debit' ? 'Debit' : 'Credit',
    Number(t.amount || 0).toFixed(2),
    t.status || 'success',
    t.id,
  ]);
  return [HEAD, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function downloadWalletStatement(transactions) {
  // BOM so Excel opens the file as UTF-8.
  const blob = new Blob(['﻿', walletStatementCsv(transactions)], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wallet-statement_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

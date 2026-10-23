const currencySymbols = {
  CNY: '\u00a5',
  USD: '$',
  RUB: '\u20bd',
  EUR: '\u20ac',
};

export function formatCurrency(value, currency = 'CNY') {
  const code = String(currency || 'CNY').toUpperCase();
  const amount = Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
  const symbol = currencySymbols[code];

  if (!symbol) return `${amount} ${code}`;
  return code === 'RUB' ? `${amount} ${symbol}` : `${symbol}${amount}`;
}

export function hasDisplayablePrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

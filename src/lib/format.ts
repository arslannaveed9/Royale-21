export function money(value: number) {
  const abs = Math.abs(Math.round(value)).toLocaleString();
  return `${value < 0 ? "-" : ""}$${abs}`;
}

export function signedMoney(value: number) {
  if (value > 0) return `+${money(value)}`;
  if (value < 0) return money(value);
  return money(0);
}

export function getWastedRatePerMin(scamType?: string): number {
  if (!scamType) return 0.15;
  const lower = scamType.toLowerCase();
  if (
    lower.includes('tech support') ||
    lower.includes('refund') ||
    lower.includes('irs') ||
    lower.includes('govt') ||
    lower.includes('crypto') ||
    lower.includes('bank')
  ) {
    return 0.15;
  }
  return 0.10;
}

export function calculateWastedFinancialImpact(scamType: string | undefined, totalMinutes: number): number {
  const rate = getWastedRatePerMin(scamType);
  return totalMinutes * rate;
}

export function formatFinancialImpact(scamType: string | undefined, totalMinutes: number): string {
  const amount = calculateWastedFinancialImpact(scamType, totalMinutes);
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

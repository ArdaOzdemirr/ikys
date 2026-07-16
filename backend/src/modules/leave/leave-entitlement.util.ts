/** İşe giriş tarihinden bugüne (veya verilen tarihe) kaç tam kıdem yılı tamamlanmış (yıl dönümü bazlı). */
export function completedServiceYears(hireDate: Date, asOf: Date = new Date()): number {
  let years = asOf.getFullYear() - hireDate.getFullYear();
  const anniversary = new Date(hireDate);
  anniversary.setFullYear(hireDate.getFullYear() + years);
  if (anniversary > asOf) years--;
  return Math.max(0, years);
}

/**
 * 4857 sayılı İş Kanunu Madde 53'e göre, işe giriş tarihinden bugüne kadar
 * BİRİKEN toplam yıllık izin hakkı. Hiçbir zaman sıfırlanmaz: her tamamlanan
 * kıdem yılı, o yıldaki kıdem kademesine göre eklenir.
 *  - 1-4. kıdem yılları: yılda 14 gün
 *  - 5-14. kıdem yılları: yılda 20 gün
 *  - 15+ kıdem yılları: yılda 26 gün
 */
export function cumulativeAnnualLeaveEntitlement(hireDate: Date, asOf: Date = new Date()): number {
  const n = completedServiceYears(hireDate, asOf);
  const tier1 = Math.min(n, 4) * 14;
  const tier2 = Math.max(0, Math.min(n, 14) - 4) * 20;
  const tier3 = Math.max(0, n - 14) * 26;
  return tier1 + tier2 + tier3;
}

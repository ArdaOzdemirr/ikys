/**
 * 2024 ve 2025 yılları için, şirketin daha önce Excel'de elle tuttuğu yıllık
 * izin tablosunun BİREBİR aynısı. Bu iki yıl "kapanmış" kabul edilir ve canlı
 * formülle yeniden hesaplanmaz — çünkü o Excel'in "YIL SONU KALAN" (2000 yılı
 * düzeltme havuzu) alanı tarihsiz bir toplam olduğundan, Ağustos 2025
 * öncesindeki kullanımın ay ay/yıl yıl kırılımı bizim veritabanımızda yeniden
 * üretilemez (bkz. "İzin Detay 2025" notu: "Ağustos 2025'ten itibaren
 * bilgiler tutulmaktadır"). 2026 ve sonrası için canlı hesaplama kullanılır.
 *
 * Anahtar: employeeNo (kişinin veritabanı id'si ortam değişse de sabit kalsın diye).
 */
export interface HistoricalYearBreakdown {
  eklenen: number;
  yilSonuKalan: number;
  monthly: number[]; // Ocak..Aralık
  kalan: number;
  ucretsiz: number;
  rapor: number;
}

export const HISTORICAL_LEAVE_OVERRIDES: Record<string, Record<number, HistoricalYearBreakdown>> = {
  'EMP-SAVAS': {
    2024: {
      eklenen: 20,
      yilSonuKalan: 45,
      monthly: [0, 0, 0, 0, 0, 0, 0, 20, 0, 0.5, 1, 2.5],
      kalan: 41,
      ucretsiz: 0,
      rapor: 0,
    },
    2025: {
      eklenen: 20,
      yilSonuKalan: 41,
      monthly: [1, 1, 1.5, 1.5, 1.5, 1.5, 3.5, 1.5, 7.5, 1.5, 2, 0.5],
      kalan: 36.5,
      ucretsiz: 0,
      rapor: 0,
    },
  },
  'EMP-ABIDIN': {
    2024: {
      eklenen: 14,
      yilSonuKalan: 0,
      monthly: [0, 0, 0, 0, 0, 0, 0, 7, 0, 0.5, 3, 3],
      kalan: 0.5,
      ucretsiz: 0,
      rapor: 0,
    },
    2025: {
      eklenen: 14,
      yilSonuKalan: 0.5,
      monthly: [3, 0, 0, 3, 0, 0, 0.5, 1.5, 1.5, 1.5, 5, 1.5],
      kalan: -3,
      ucretsiz: 0,
      rapor: 0,
    },
  },
};

export function getHistoricalOverride(
  employeeNo: string,
  year: number,
): HistoricalYearBreakdown | null {
  return HISTORICAL_LEAVE_OVERRIDES[employeeNo]?.[year] ?? null;
}

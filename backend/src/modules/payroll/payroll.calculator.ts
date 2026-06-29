import { Injectable } from '@nestjs/common';

/**
 * Bordro Hesaplama Motoru
 * Belge: "SGK işçi payı, gelir vergisi, damga vergisi, BES"
 *
 * NOT: Vergi dilimleri ve oranlar her yıl değişir.
 * Bu hesaplamalar TR 2025 mevzuatına göre baz değerlerdir.
 * Üretimde Gelir İdaresi'nin güncel oranlarıyla senkronize edilmelidir.
 */
@Injectable()
export class PayrollCalculator {
  // Standart oranlar (.env üzerinden override edilebilir)
  private readonly SGK_EMPLOYEE_RATE = parseFloat(process.env.SGK_EMPLOYEE_RATE || '0.14');
  private readonly UNEMPLOYMENT_INS_RATE = parseFloat(process.env.UNEMPLOYMENT_INS_RATE || '0.01');
  private readonly STAMP_TAX_RATE = parseFloat(process.env.STAMP_TAX_RATE || '0.00759');

  // Gelir vergisi dilimleri (TR 2025 - örnek değerler)
  private readonly TAX_BRACKETS = [
    { upTo: 158000, rate: 0.15 },
    { upTo: 330000, rate: 0.20 },
    { upTo: 1200000, rate: 0.27 },
    { upTo: 4300000, rate: 0.35 },
    { upTo: Infinity, rate: 0.40 },
  ];

  calculate(input: {
    grossSalary: number;
    agi?: number;
    mealAllowance?: number;
    transportAllowance?: number;
    overtimePay?: number;
    bonus?: number;
    bes?: number;
    cumulativeTaxBase?: number; // Yıl içi birikimli matrah
  }) {
    const gross = input.grossSalary;
    const agi = input.agi || 0;
    const meal = input.mealAllowance || 0;
    const transport = input.transportAllowance || 0;
    const overtime = input.overtimePay || 0;
    const bonus = input.bonus || 0;
    const bes = input.bes || 0;

    // 1) SGK matrahı = brüt + fazla mesai + ikramiye
    const sgkBase = gross + overtime + bonus;
    const sgkEmployee = +(sgkBase * this.SGK_EMPLOYEE_RATE).toFixed(2);
    const unemploymentIns = +(sgkBase * this.UNEMPLOYMENT_INS_RATE).toFixed(2);

    // 2) Gelir vergisi matrahı = SGK matrahı - SGK kesintileri
    const taxBase = sgkBase - sgkEmployee - unemploymentIns;
    const cumulative = input.cumulativeTaxBase || 0;
    const incomeTax = +this.calculateProgressiveTax(taxBase, cumulative).toFixed(2);

    // 3) Damga vergisi (brüt üzerinden)
    const stampTax = +(sgkBase * this.STAMP_TAX_RATE).toFixed(2);

    // 4) Toplam kesinti
    const totalDeductions = sgkEmployee + unemploymentIns + incomeTax + stampTax + bes;

    // 5) Net = Brüt + yan haklar - kesintiler + AGİ
    const netSalary = +(sgkBase + meal + transport + agi - totalDeductions).toFixed(2);

    return {
      grossSalary: gross,
      sgkBase,
      sgkEmployee,
      unemploymentIns,
      taxBase,
      incomeTax,
      stampTax,
      bes,
      totalDeductions: +totalDeductions.toFixed(2),
      mealAllowance: meal,
      transportAllowance: transport,
      agi,
      overtimePay: overtime,
      bonus,
      netSalary,
    };
  }

  private calculateProgressiveTax(currentBase: number, cumulative: number): number {
    let remaining = currentBase;
    let tax = 0;
    let processed = cumulative;

    for (const bracket of this.TAX_BRACKETS) {
      if (processed >= bracket.upTo) continue;
      const availableInBracket = bracket.upTo - processed;
      const inThisBracket = Math.min(remaining, availableInBracket);
      tax += inThisBracket * bracket.rate;
      remaining -= inThisBracket;
      processed += inThisBracket;
      if (remaining <= 0) break;
    }
    return tax;
  }
}

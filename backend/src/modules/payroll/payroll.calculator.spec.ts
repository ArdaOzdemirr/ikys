import { PayrollCalculator } from './payroll.calculator';

describe('PayrollCalculator', () => {
  let calculator: PayrollCalculator;

  beforeEach(() => {
    calculator = new PayrollCalculator();
  });

  it('temel brüt maaş için kesintileri doğru hesaplar', () => {
    const result = calculator.calculate({ grossSalary: 50000 });

    expect(result.sgkBase).toBe(50000);
    expect(result.sgkEmployee).toBeCloseTo(50000 * 0.14, 2);
    expect(result.unemploymentIns).toBeCloseTo(50000 * 0.01, 2);
    expect(result.stampTax).toBeCloseTo(50000 * 0.00759, 2);
  });

  it('net maaş brütten küçük olmalı (kesinti varken)', () => {
    const result = calculator.calculate({ grossSalary: 50000 });
    expect(result.netSalary).toBeLessThan(result.grossSalary);
  });

  it('yemek/yol yardımı ve AGİ net maaşı artırır', () => {
    const base = calculator.calculate({ grossSalary: 50000 });
    const withAllowances = calculator.calculate({
      grossSalary: 50000,
      mealAllowance: 2000,
      transportAllowance: 1000,
      agi: 500,
    });
    expect(withAllowances.netSalary).toBeGreaterThan(base.netSalary);
  });

  it('fazla mesai ve ikramiye SGK matrahına eklenir', () => {
    const result = calculator.calculate({
      grossSalary: 50000,
      overtimePay: 1000,
      bonus: 2000,
    });
    expect(result.sgkBase).toBe(53000);
  });

  it('BES kesintisi toplam kesintiye eklenir ama SGK matrahını değiştirmez', () => {
    const withoutBes = calculator.calculate({ grossSalary: 50000 });
    const withBes = calculator.calculate({ grossSalary: 50000, bes: 500 });

    expect(withBes.sgkBase).toBe(withoutBes.sgkBase);
    expect(withBes.totalDeductions).toBeCloseTo(withoutBes.totalDeductions + 500, 2);
    expect(withBes.netSalary).toBeCloseTo(withoutBes.netSalary - 500, 2);
  });

  it('kümülatif matrah üst dilime taştığında gelir vergisi oranı artar', () => {
    // Düşük kümülatif matrahla başlayan biri %15 dilimde kalır
    const lowCumulative = calculator.calculate({
      grossSalary: 20000,
      cumulativeTaxBase: 0,
    });
    // Zaten ilk dilimi (158.000) aşmış biri için aynı brüt artık %20 dilimine girer
    const highCumulative = calculator.calculate({
      grossSalary: 20000,
      cumulativeTaxBase: 150000,
    });

    expect(highCumulative.incomeTax).toBeGreaterThan(lowCumulative.incomeTax);
  });

  it('gelir vergisi matrahı sıfır veya negatifse vergi sıfırdır', () => {
    const result = calculator.calculate({ grossSalary: 0 });
    expect(result.incomeTax).toBe(0);
    expect(result.netSalary).toBe(0);
  });
});

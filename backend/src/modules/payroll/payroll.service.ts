import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PayrollCalculator } from './payroll.calculator';
import { ExpenseStatus, NotificationType, Role } from '@prisma/client';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { GeneratePayrollDto, SetSalaryDto, CreateExpenseDto, ApproveExpenseDto } from './payroll.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PayrollService {
  private readonly receiptDir = path.join(process.cwd(), 'uploads', 'receipts');

  constructor(
    private prisma: PrismaService,
    private calculator: PayrollCalculator,
    private notifications: NotificationsService,
  ) {
    if (!fs.existsSync(this.receiptDir)) {
      fs.mkdirSync(this.receiptDir, { recursive: true });
    }
  }

  // ============= MAAŞ KONFİGÜRASYONU =============
  async setSalary(personnelId: string, dto: SetSalaryDto) {
    return this.prisma.salaryConfig.upsert({
      where: { personnelId },
      create: { personnelId, ...dto, effectiveFrom: new Date(dto.effectiveFrom || Date.now()) },
      update: { ...dto, effectiveFrom: new Date(dto.effectiveFrom || Date.now()) },
    });
  }

  // ============= BORDRO ÜRETME =============
  async generatePayroll(dto: GeneratePayrollDto) {
    const config = await this.prisma.salaryConfig.findUnique({
      where: { personnelId: dto.personnelId },
    });
    if (!config) throw new NotFoundException('Personelin maaş bilgisi tanımlı değil');

    // Aynı ay için bordro var mı?
    const existing = await this.prisma.payroll.findUnique({
      where: {
        personnelId_year_month: {
          personnelId: dto.personnelId,
          year: dto.year,
          month: dto.month,
        },
      },
    });
    if (existing) throw new BadRequestException('Bu ay için bordro zaten mevcut');

    // Fazla mesai entegrasyonu
    const start = new Date(dto.year, dto.month - 1, 1);
    const end = new Date(dto.year, dto.month, 0);
    const attendances = await this.prisma.attendance.findMany({
      where: { personnelId: dto.personnelId, date: { gte: start, lte: end } },
    });
    const totalOvertimeMin = attendances.reduce((s, a) => s + a.overtimeMin, 0);
    const hourlyRate = +config.grossSalary / 225; // ~225 saat/ay
    const overtimePay = +((totalOvertimeMin / 60) * hourlyRate * 1.5).toFixed(2); // %50 zamlı

    // Yıl içi birikimli vergi matrahı
    const cumulative = await this.prisma.payroll.aggregate({
      where: {
        personnelId: dto.personnelId,
        year: dto.year,
        month: { lt: dto.month },
      },
      _sum: { grossSalary: true },
    });

    const calc = this.calculator.calculate({
      grossSalary: +config.grossSalary,
      agi: +config.agi,
      mealAllowance: +config.mealAllowance,
      transportAllowance: +config.transportAllowance,
      overtimePay,
      bonus: dto.bonus || 0,
      bes: +config.bes,
      cumulativeTaxBase: +(cumulative._sum.grossSalary || 0),
    });

    return this.prisma.payroll.create({
      data: {
        personnelId: dto.personnelId,
        year: dto.year,
        month: dto.month,
        grossSalary: calc.grossSalary,
        agi: calc.agi,
        mealAllowance: calc.mealAllowance,
        transportAllowance: calc.transportAllowance,
        overtimePay: calc.overtimePay,
        bonus: calc.bonus,
        sgkEmployee: calc.sgkEmployee,
        unemploymentIns: calc.unemploymentIns,
        incomeTax: calc.incomeTax,
        stampTax: calc.stampTax,
        bes: calc.bes,
        netSalary: calc.netSalary,
      },
    });
  }

  /**
   * Belge: "Her ayın sonunda personelin PDF formatında bordrosunu sistemden indirebilmesi"
   */
  async generatePdf(payrollId: string): Promise<Buffer> {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        personnel: {
          include: { department: true, position: true },
        },
      },
    });
    if (!payroll) throw new NotFoundException('Bordro bulunamadı');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Başlık
      doc.fontSize(18).text('MAAŞ BORDROSU', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`${this.monthName(payroll.month)} ${payroll.year}`, { align: 'center' });
      doc.moveDown(1);

      // Personel bilgileri
      const p = payroll.personnel;
      doc.fontSize(11);
      doc.text(`Sicil No: ${p.employeeNo}`);
      doc.text(`Ad Soyad: ${p.firstName} ${p.lastName}`);
      doc.text(`Departman: ${p.department?.name || '-'}`);
      doc.text(`Pozisyon: ${p.position?.title || '-'}`);
      doc.moveDown(1);

      // Tablo başlığı
      doc.fontSize(12).text('KAZANÇLAR', { underline: true });
      doc.fontSize(10);
      this.row(doc, 'Brüt Maaş', payroll.grossSalary);
      this.row(doc, 'AGİ', payroll.agi);
      this.row(doc, 'Yemek Yardımı', payroll.mealAllowance);
      this.row(doc, 'Yol Yardımı', payroll.transportAllowance);
      this.row(doc, 'Fazla Mesai', payroll.overtimePay);
      this.row(doc, 'İkramiye', payroll.bonus);

      doc.moveDown(0.5);
      doc.fontSize(12).text('KESİNTİLER', { underline: true });
      doc.fontSize(10);
      this.row(doc, 'SGK İşçi Payı', payroll.sgkEmployee);
      this.row(doc, 'İşsizlik Sigortası', payroll.unemploymentIns);
      this.row(doc, 'Gelir Vergisi', payroll.incomeTax);
      this.row(doc, 'Damga Vergisi', payroll.stampTax);
      this.row(doc, 'BES', payroll.bes);

      doc.moveDown(1);
      doc.fontSize(13).fillColor('green').text(
        `NET ÖDEME: ${(+payroll.netSalary).toFixed(2)} ₺`,
        { align: 'right' },
      );

      doc.moveDown(2);
      doc.fontSize(8).fillColor('gray').text(
        `Bu bordro ${new Date().toLocaleString('tr-TR')} tarihinde otomatik oluşturulmuştur.`,
        { align: 'center' },
      );

      doc.end();
    });
  }

  myPayrolls(personnelId: string) {
    return this.prisma.payroll.findMany({
      where: { personnelId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  // ============= MASRAF / PARA TALEBİ YÖNETİMİ =============
  // Belge: "Masraf Modülü - yemek, yol ve iş harcamalarını talep edeceği"
  // Not: "avans" kategorisi fiş gerektirmeyen doğrudan para talebi içindir.
  async createExpense(personnelId: string, dto: CreateExpenseDto) {
    const expense = await this.prisma.expense.create({
      data: {
        personnelId,
        category: dto.category,
        amount: dto.amount,
        currency: dto.currency || 'TRY',
        date: new Date(dto.date),
        description: dto.description,
        receiptUrl: dto.receiptUrl,
      },
    });

    const requester = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
      select: { firstName: true, lastName: true },
    });
    const approvers = await this.prisma.personnel.findMany({
      where: { status: 'ACTIVE', user: { role: { in: [Role.ACCOUNTING, Role.ADMIN] } } },
      select: { id: true },
    });
    const title = `${requester?.firstName} ${requester?.lastName} - ${dto.amount} ${dto.currency || 'TRY'} talebi`;
    for (const a of approvers) {
      void this.notifications.create({
        recipientId: a.id,
        type: NotificationType.EXPENSE_PENDING,
        title,
        body: dto.description,
        refType: 'EXPENSE',
        refId: expense.id,
      });
    }

    return expense;
  }

  myExpenses(personnelId: string) {
    return this.prisma.expense.findMany({
      where: { personnelId },
      orderBy: { date: 'desc' },
    });
  }

  pendingExpenses() {
    return this.prisma.expense.findMany({
      where: { status: ExpenseStatus.PENDING },
      include: {
        personnel: { select: { firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Muhasebe: onaylanmış ama henüz ödenmemiş talepler. */
  approvedUnpaidExpenses() {
    return this.prisma.expense.findMany({
      where: { status: ExpenseStatus.APPROVED },
      include: {
        personnel: { select: { firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: { approvedAt: 'asc' },
    });
  }

  async approveExpense(id: string, approverId: string, dto: ApproveExpenseDto) {
    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        status: dto.approved ? ExpenseStatus.APPROVED : ExpenseStatus.REJECTED,
        approverId,
        approvedAt: new Date(),
        rejectionReason: dto.approved ? null : dto.rejectionReason,
      },
    });

    void this.notifications.create({
      recipientId: expense.personnelId,
      type: dto.approved ? NotificationType.EXPENSE_APPROVED : NotificationType.EXPENSE_REJECTED,
      title: dto.approved
        ? `Masraf/para talebiniz onaylandı (${expense.amount} ${expense.currency})`
        : `Masraf/para talebiniz reddedildi`,
      body: dto.approved ? undefined : dto.rejectionReason,
      refType: 'EXPENSE',
      refId: expense.id,
    });

    return expense;
  }

  /** Muhasebe: onaylanmış talebi gerçekten ödeyince çağrılır. */
  async payExpense(id: string, payerId: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Masraf/para talebi bulunamadı');
    if (expense.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException('Yalnızca onaylanmış talepler ödenebilir');
    }

    const paid = await this.prisma.expense.update({
      where: { id },
      data: { status: ExpenseStatus.PAID, paidAt: new Date() },
    });

    void this.notifications.create({
      recipientId: expense.personnelId,
      type: NotificationType.EXPENSE_PAID,
      title: `Masraf/para talebiniz ödendi (${expense.amount} ${expense.currency})`,
      refType: 'EXPENSE',
      refId: expense.id,
    });

    return paid;
  }

  /** Masraf talebine ek fiş/fatura yükler; dönen url, createExpense'e receiptUrl olarak verilir. */
  uploadReceipt(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Dosya gönderilmedi');

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) throw new BadRequestException('Dosya boyutu 10MB\'ı aşamaz');

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Sadece PDF veya resim dosyaları yüklenebilir (fiş/fatura)');
    }

    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    fs.writeFileSync(path.join(this.receiptDir, fileName), file.buffer);

    return { receiptUrl: `/api/v1/payroll/expenses/receipt/${fileName}`, fileName };
  }

  getReceiptFile(fileName: string): { buffer: Buffer; mimeType: string } {
    const filePath = path.join(this.receiptDir, fileName);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Dosya bulunamadı');
    const ext = path.extname(fileName).toLowerCase();
    const mimeType =
      ext === '.pdf' ? 'application/pdf' :
      ext === '.png' ? 'image/png' :
      ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { buffer: fs.readFileSync(filePath), mimeType };
  }

  // === Helpers ===
  private row(doc: PDFKit.PDFDocument, label: string, value: any) {
    const num = +value;
    doc.text(`${label}:`, { continued: true });
    doc.text(`${num.toFixed(2)} ₺`, { align: 'right' });
  }

  private monthName(m: number): string {
    return ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
            'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'][m - 1];
  }
}

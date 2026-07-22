import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import {
  ApproveExpenseDto,
  CreateExpenseDto,
  GeneratePayrollDto,
  SetSalaryDto,
} from './payroll.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

@ApiTags('payroll')
@ApiBearerAuth()
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly service: PayrollService,
    private readonly prisma: PrismaService,
  ) {}

  /** Çağıranın Personnel kaydını getirir; yoksa anlamlı bir hata fırlatır (500 değil). */
  private async requirePersonnel(userId: string) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) {
      throw new ForbiddenException(
        'Bu işlemi yapabilmek için bir personel kaydınız olmalı',
      );
    }
    return personnel;
  }

  /**
   * Bordro/maaş yönetimi: İK ve hiyerarşinin en tepesindeki (yöneticisi
   * olmayan) admin yapabilir. Diğer ADMIN'ler (örn. Savaş) sadece kendi
   * bordrolarını görür, başkasınınkini yönetemez.
   */
  private async assertPayrollManager(userId: string, role: string) {
    if (role === Role.HR || role === Role.ACCOUNTING) return;
    if (role === Role.ADMIN) {
      const p = await this.prisma.personnel.findUnique({
        where: { userId },
        select: { managerId: true },
      });
      if (p && p.managerId === null) return;
    }
    throw new ForbiddenException('Bu işlem için yetkiniz yok');
  }

  // === Maaş Konfigürasyonu ===
  @Post('salary/:personnelId')
  async setSalary(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('personnelId') personnelId: string,
    @Body() dto: SetSalaryDto,
  ) {
    await this.assertPayrollManager(userId, role);
    return this.service.setSalary(personnelId, dto);
  }

  // === Bordro ===
  @Get('personnel')
  @ApiOperation({ summary: 'Aktif personel + maaş bilgisi (bordro ekranı için)' })
  async payrollPersonnel(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    await this.assertPayrollManager(userId, role);
    return this.prisma.personnel.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNo: true,
        department: { select: { name: true } },
        salaryConfig: true,
      },
      orderBy: [{ firstName: 'asc' }],
    });
  }

  @Post('generate')
  @ApiOperation({ summary: 'Aylık bordro oluştur (Belge: FR-05)' })
  async generate(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: GeneratePayrollDto,
  ) {
    await this.assertPayrollManager(userId, role);
    return this.service.generatePayroll(dto);
  }

  @Get('me')
  async myPayrolls(@CurrentUser('userId') userId: string) {
    const personnel = await this.requirePersonnel(userId);
    return this.service.myPayrolls(personnel.id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Bordro PDF indir (sadece sahibi ya da bordro yöneticisi)' })
  async pdf(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Res() res: Response,
  ) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      select: { personnelId: true },
    });
    if (!payroll) throw new NotFoundException('Bordro bulunamadı');

    const personnel = await this.requirePersonnel(userId);
    if (payroll.personnelId !== personnel.id) {
      await this.assertPayrollManager(userId, role);
    }

    const buffer = await this.service.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bordro-${id}.pdf"`,
    });
    res.send(buffer);
  }

  // === Masraf / Para Talebi ===
  @Post('expenses/upload-receipt')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Masraf talebine eklenecek fiş/fatura yükler (PDF/resim, max 10MB)' })
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  uploadReceipt(@UploadedFile() file: Express.Multer.File) {
    return this.service.uploadReceipt(file);
  }

  @Get('expenses/receipt/:fileName')
  @ApiOperation({ summary: 'Yüklenen fiş/fatura dosyasını görüntüler' })
  receipt(@Param('fileName') fileName: string, @Res() res: Response) {
    const { buffer, mimeType } = this.service.getReceiptFile(fileName);
    res.set({ 'Content-Type': mimeType });
    res.send(buffer);
  }

  @Post('expenses')
  async createExpense(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    const personnel = await this.requirePersonnel(userId);
    return this.service.createExpense(personnel.id, dto);
  }

  @Get('expenses/me')
  async myExpenses(@CurrentUser('userId') userId: string) {
    const personnel = await this.requirePersonnel(userId);
    return this.service.myExpenses(personnel.id);
  }

  @Get('expenses/pending')
  @Roles(Role.HR, Role.ACCOUNTING)
  pendingExpenses() {
    return this.service.pendingExpenses();
  }

  @Get('expenses/approved-unpaid')
  @Roles(Role.HR, Role.ACCOUNTING)
  @ApiOperation({ summary: 'Muhasebe: onaylanmış, ödemesi bekleyen talepler' })
  approvedUnpaidExpenses() {
    return this.service.approvedUnpaidExpenses();
  }

  @Patch('expenses/:id/approve')
  @Roles(Role.HR, Role.ACCOUNTING)
  async approveExpense(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: ApproveExpenseDto,
  ) {
    const personnel = await this.requirePersonnel(userId);
    return this.service.approveExpense(id, personnel.id, dto);
  }

  @Patch('expenses/:id/pay')
  @Roles(Role.HR, Role.ACCOUNTING)
  @ApiOperation({ summary: 'Muhasebe: onaylanmış talebi öder' })
  async payExpense(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    const personnel = await this.requirePersonnel(userId);
    return this.service.payExpense(id, personnel.id);
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CandidateStatus, ContractType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { CvParserService } from './cv-parser.service';

@Injectable()
export class RecruitmentService {
  private readonly cvDir = path.join(process.cwd(), 'uploads', 'cv');
  private readonly logger = new Logger('RecruitmentService');

  constructor(
    private prisma: PrismaService,
    private cvParser: CvParserService,
  ) {
    if (!fs.existsSync(this.cvDir)) {
      fs.mkdirSync(this.cvDir, { recursive: true });
    }
  }

  // ============= CV YÜKLEME (İK) =============
  private saveCvFile(file: Express.Multer.File): string {
    if (!file) throw new BadRequestException('CV dosyası gönderilmedi');
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException("CV boyutu 10MB'ı aşamaz");
    }
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Sadece PDF, Word veya resim yüklenebilir');
    }
    const ext = path.extname(file.originalname) || '.pdf';
    const fileName = `cv_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}${ext}`;
    fs.writeFileSync(path.join(this.cvDir, fileName), file.buffer);
    return `/api/v1/recruitment/cv/${fileName}`;
  }

  /** İK: mail/diğer yollarla gelen CV ile yeni aday oluşturur. */
  async createCandidateWithCv(data: any, file?: Express.Multer.File) {
    if (!data.firstName || !data.lastName || !data.email) {
      throw new BadRequestException('Ad, soyad ve e-posta zorunludur');
    }
    const cvUrl = file ? this.saveCvFile(file) : undefined;
    const candidate = await this.prisma.candidate.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        linkedinUrl: data.linkedinUrl || null,
        source: data.source || 'Manuel (İK)',
        jobPostingId: data.jobPostingId || null,
        cvUrl,
      },
    });
    if (file) this.parseCvAsync(candidate.id, file.buffer, file.mimetype);
    return candidate;
  }

  /** Var olan adaya CV yükler/günceller. */
  async uploadCv(candidateId: string, file: Express.Multer.File) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) throw new NotFoundException('Aday bulunamadı');
    const cvUrl = this.saveCvFile(file);
    const updated = await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { cvUrl },
    });
    this.parseCvAsync(candidateId, file.buffer, file.mimetype);
    return updated;
  }

  /** Fire-and-forget: CV'yi AI ile ayrıştırıp Candidate kaydını günceller. */
  private parseCvAsync(candidateId: string, buffer: Buffer, mimeType: string): void {
    this.cvParser
      .parse(buffer, mimeType)
      .then((parsed) =>
        this.prisma.candidate.update({
          where: { id: candidateId },
          data: {
            cvSkills: parsed.skills,
            cvLanguages: parsed.languages,
            cvExperienceYears: parsed.experienceYears,
            cvSummary: parsed.summary,
            cvParsedAt: new Date(),
            cvParseError: null,
          },
        }),
      )
      .catch((e: any) => {
        this.logger.warn(`CV ayrıştırma başarısız (${candidateId}): ${e?.message || e}`);
        return this.prisma.candidate
          .update({
            where: { id: candidateId },
            data: { cvParseError: e?.message || 'Bilinmeyen hata' },
          })
          .catch(() => undefined);
      });
  }

  /** Manuel: var olan CV'yi yeniden ayrıştır (örn. ilk deneme başarısız olduysa). */
  async reparseCv(candidateId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) throw new NotFoundException('Aday bulunamadı');
    if (!candidate.cvUrl) throw new BadRequestException('Adayın yüklenmiş bir CV\'si yok');
    const fileName = path.basename(candidate.cvUrl);
    const { buffer, mimeType } = this.getCvFile(fileName);
    this.parseCvAsync(candidateId, buffer, mimeType);
    return { message: 'CV ayrıştırma başlatıldı' };
  }

  getCvFile(fileName: string): { buffer: Buffer; mimeType: string } {
    // Güvenlik: yalnızca dosya adı, yol gezintisi engellenir
    const safe = path.basename(fileName);
    const filePath = path.join(this.cvDir, safe);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('CV dosyası bulunamadı');
    }
    const ext = path.extname(safe).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    return {
      buffer: fs.readFileSync(filePath),
      mimeType: mimeMap[ext] || 'application/octet-stream',
    };
  }

  // ============= İŞ İLANI =============
  createPosting(data: any) {
    return this.prisma.jobPosting.create({ data });
  }

  listPostings(active?: boolean) {
    return this.prisma.jobPosting.findMany({
      where: active === undefined ? {} : { isActive: active },
      include: { _count: { select: { candidates: true } } },
      orderBy: { publishedAt: 'desc' },
    });
  }

  closePosting(id: string) {
    return this.prisma.jobPosting.update({
      where: { id },
      data: { isActive: false, closedAt: new Date() },
    });
  }

  async deletePosting(id: string) {
    // Aday başvurusu var mı?
    const candidateCount = await this.prisma.candidate.count({
      where: { jobPostingId: id },
    });
    if (candidateCount > 0) {
      // Adayları boşa düşürüp ilanı sil (KVKK uyumu için adayları silmiyoruz)
      await this.prisma.candidate.updateMany({
        where: { jobPostingId: id },
        data: { jobPostingId: null },
      });
    }
    return this.prisma.jobPosting.delete({ where: { id } });
  }

  updatePosting(id: string, data: any) {
    return this.prisma.jobPosting.update({ where: { id }, data });
  }

  // ============= ADAY HAVUZU (Belge: Aday havuzu, CV yükleme) =============
  createCandidate(data: any) {
    return this.prisma.candidate.create({ data });
  }

  listCandidates(filters: { status?: CandidateStatus; jobPostingId?: string; search?: string }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.jobPostingId) where.jobPostingId = filters.jobPostingId;
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.candidate.findMany({
      where,
      include: { jobPosting: true, notes: true },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async findCandidate(id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: { jobPosting: true, notes: { orderBy: { date: 'desc' } } },
    });
    if (!candidate) throw new NotFoundException('Aday bulunamadı');
    return candidate;
  }

  updateStatus(id: string, status: CandidateStatus) {
    return this.prisma.candidate.update({ where: { id }, data: { status } });
  }

  // ============= MÜLAKAT NOTLARI (Belge: Mülakat notları) =============
  addInterviewNote(candidateId: string, data: any) {
    return this.prisma.interviewNote.create({
      data: { candidateId, ...data },
    });
  }

  /**
   * Belge: "Aday → çalışan dönüşümü"
   * Adayı işe alındı statüsüne çevirip, personel kaydı oluşturur.
   */
  async hireCandidate(candidateId: string, hireData: {
    employeeNo: string;
    tcKimlikNo: string;
    departmentId?: string;
    positionId?: string;
    managerId?: string;
    hireDate: string;
    contractType?: ContractType;
    grossSalary?: number;
    password?: string;
  }) {
    const candidate = await this.findCandidate(candidateId);

    return this.prisma.$transaction(async (tx) => {
      // Kullanıcı oluştur
      const passwordHash = await bcrypt.hash(hireData.password || 'Welcome123!', 12);
      const user = await tx.user.create({
        data: {
          email: candidate.email,
          passwordHash,
          role: Role.EMPLOYEE,
        },
      });

      // Personel kaydı
      const personnel = await tx.personnel.create({
        data: {
          employeeNo: hireData.employeeNo,
          userId: user.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          tcKimlikNo: hireData.tcKimlikNo,
          phone: candidate.phone,
          departmentId: hireData.departmentId,
          positionId: hireData.positionId,
          managerId: hireData.managerId,
          contractType: hireData.contractType || ContractType.PERMANENT,
          hireDate: new Date(hireData.hireDate),
        },
      });

      // Maaş tanımı (verilmişse)
      if (hireData.grossSalary) {
        await tx.salaryConfig.create({
          data: {
            personnelId: personnel.id,
            grossSalary: hireData.grossSalary,
          },
        });
      }

      // Adayı güncelle
      await tx.candidate.update({
        where: { id: candidateId },
        data: { status: CandidateStatus.HIRED, hiredAt: new Date() },
      });

      return { candidate: candidateId, user, personnel };
    });
  }

  // ============= İSTATİSTİK =============
  async stats() {
    const byStatus = await this.prisma.candidate.groupBy({
      by: ['status'],
      _count: true,
    });
    const totalActivePostings = await this.prisma.jobPosting.count({
      where: { isActive: true },
    });
    return { byStatus, totalActivePostings };
  }
}

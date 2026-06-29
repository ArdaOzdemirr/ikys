import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'documents');

  constructor(private prisma: PrismaService) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadDocument(
    personnelId: string,
    file: Express.Multer.File,
    type: string,
    uploadedBy: string,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya gönderilmedi');
    }

    // Boyut kontrolü (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('Dosya boyutu 10MB\'ı aşamaz');
    }

    // İzin verilen MIME tipleri
    const allowedTypes = [
      'application/pdf',
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Sadece PDF, Word veya resim dosyaları yüklenebilir',
      );
    }

    // Personel kontrolü
    const personnel = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
    });
    if (!personnel) throw new NotFoundException('Personel bulunamadı');

    // Dosya adı: <personnelId>_<timestamp>_<rastgele>.<ext>
    const ext = path.extname(file.originalname);
    const fileName = `${personnelId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(this.uploadDir, fileName);

    // Diske yaz
    fs.writeFileSync(filePath, file.buffer);

    // DB'ye kaydet
    return this.prisma.document.create({
      data: {
        personnelId,
        type,
        fileName: file.originalname,
        fileUrl: `/api/v1/documents/file/${fileName}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy,
      },
    });
  }

  async listForPersonnel(personnelId: string) {
    return this.prisma.document.findMany({
      where: { personnelId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getFile(fileName: string): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
    const filePath = path.join(this.uploadDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Dosya bulunamadı');
    }

    // DB'den dokümanı al (mime type ve orijinal ad için)
    const doc = await this.prisma.document.findFirst({
      where: { fileUrl: { contains: fileName } },
    });
    if (!doc) throw new NotFoundException('Belge kaydı bulunamadı');

    return {
      buffer: fs.readFileSync(filePath),
      mimeType: doc.mimeType,
      originalName: doc.fileName,
    };
  }

  async deleteDocument(id: string, userRole: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Belge bulunamadı');

    // Sadece HR/Admin silebilir
    if (!['HR', 'ADMIN'].includes(userRole)) {
      throw new ForbiddenException('Belge silmeye yetkiniz yok');
    }

    // Diskten sil
    const fileName = doc.fileUrl.split('/').pop();
    if (fileName) {
      const filePath = path.join(this.uploadDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    return this.prisma.document.delete({ where: { id } });
  }
}

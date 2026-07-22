import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Çağıranın kendi belgesi mi, yoksa HR/Admin mi kontrol eder. */
  private async assertOwnerOrHr(userId: string, role: string, ownerPersonnelId: string) {
    if (role === Role.HR || role === Role.ADMIN) return;
    const me = await this.prisma.personnel.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (me?.id === ownerPersonnelId) return;
    throw new ForbiddenException('Bu belgeye erişim yetkiniz yok');
  }

  @Post('upload/:personnelId')
  @Roles(Role.ADMIN, Role.HR)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Personele belge yükle (PDF/resim/Word, max 10MB)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', example: 'diploma' },
      },
    },
  })
  upload(
    @Param('personnelId') personnelId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.uploadDocument(personnelId, file, type || 'diger', userId);
  }

  @Get('personnel/:personnelId')
  @ApiOperation({ summary: 'Belge listesi (sadece sahibi ya da HR/Admin görebilir)' })
  async list(
    @Param('personnelId') personnelId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    await this.assertOwnerOrHr(userId, role, personnelId);
    return this.service.listForPersonnel(personnelId);
  }

  @Get('file/:fileName')
  @ApiOperation({ summary: 'Belge dosyasını indir (sadece sahibi ya da HR/Admin)' })
  async download(
    @Param('fileName') fileName: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Res() res: Response,
  ) {
    const { buffer, mimeType, originalName, personnelId } = await this.service.getFile(fileName);
    await this.assertOwnerOrHr(userId, role, personnelId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(originalName)}"`,
    });
    res.send(buffer);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.HR)
  delete(@Param('id') id: string, @CurrentUser('role') role: string) {
    return this.service.deleteDocument(id, role);
  }
}

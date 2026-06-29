import {
  Body,
  Controller,
  Delete,
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

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

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
  list(@Param('personnelId') personnelId: string) {
    return this.service.listForPersonnel(personnelId);
  }

  @Get('file/:fileName')
  async download(@Param('fileName') fileName: string, @Res() res: Response) {
    const { buffer, mimeType, originalName } = await this.service.getFile(fileName);
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

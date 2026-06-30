import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { RecruitmentService } from './recruitment.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CandidateStatus, Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('recruitment')
@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly service: RecruitmentService) {}

  // İlanlar
  @ApiBearerAuth()
  @Post('postings') @Roles(Role.HR, Role.ADMIN)
  createPosting(@Body() body: any) { return this.service.createPosting(body); }

  @Public()
  @Get('postings')
  @ApiOperation({ summary: 'Açık iş ilanları (public - aday başvurusu için)' })
  listPostings(@Query('active') active?: string) {
    return this.service.listPostings(active === undefined ? undefined : active === 'true');
  }

  @ApiBearerAuth()
  @Patch('postings/:id/close') @Roles(Role.HR, Role.ADMIN)
  closePosting(@Param('id') id: string) { return this.service.closePosting(id); }

  @ApiBearerAuth()
  @Patch('postings/:id') @Roles(Role.HR, Role.ADMIN)
  updatePosting(@Param('id') id: string, @Body() body: any) {
    return this.service.updatePosting(id, body);
  }

  @ApiBearerAuth()
  @Delete('postings/:id') @Roles(Role.HR, Role.ADMIN)
  deletePosting(@Param('id') id: string) {
    return this.service.deletePosting(id);
  }

  // Adaylar
  @Public()
  @Post('candidates')
  @ApiOperation({ summary: 'Aday başvurusu (public)' })
  createCandidate(@Body() body: any) { return this.service.createCandidate(body); }

  // İK: mail/diğer yollarla gelen CV ile aday oluştur (multipart: file + alanlar)
  @ApiBearerAuth()
  @Post('candidates/upload')
  @Roles(Role.HR, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'İK: CV yükleyerek yeni aday oluştur' })
  createWithCv(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return this.service.createCandidateWithCv(body, file);
  }

  // Var olan adaya CV yükle/güncelle
  @ApiBearerAuth()
  @Post('candidates/:id/cv')
  @Roles(Role.HR, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Adaya CV yükle/güncelle' })
  uploadCv(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadCv(id, file);
  }

  // CV dosyasını görüntüle/indir
  @ApiBearerAuth()
  @Get('cv/:fileName')
  @Roles(Role.HR, Role.ADMIN, Role.MANAGER)
  cv(@Param('fileName') fileName: string, @Res() res: Response) {
    const { buffer, mimeType } = this.service.getCvFile(fileName);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${fileName}"`,
    });
    res.send(buffer);
  }

  @ApiBearerAuth()
  @Get('candidates') @Roles(Role.HR, Role.ADMIN, Role.MANAGER)
  list(
    @Query('status') status?: CandidateStatus,
    @Query('jobPostingId') jobPostingId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listCandidates({ status, jobPostingId, search });
  }

  @ApiBearerAuth()
  @Get('candidates/:id') @Roles(Role.HR, Role.ADMIN, Role.MANAGER)
  detail(@Param('id') id: string) { return this.service.findCandidate(id); }

  @ApiBearerAuth()
  @Post('candidates/:id/parse-cv')
  @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'AI ile CV\'yi yeniden ayrıştır' })
  reparseCv(@Param('id') id: string) {
    return this.service.reparseCv(id);
  }

  @ApiBearerAuth()
  @Patch('candidates/:id/status') @Roles(Role.HR, Role.ADMIN, Role.MANAGER)
  updateStatus(@Param('id') id: string, @Body('status') status: CandidateStatus) {
    return this.service.updateStatus(id, status);
  }

  @ApiBearerAuth()
  @Post('candidates/:id/notes') @Roles(Role.HR, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Mülakat notu ekle' })
  addNote(@Param('id') id: string, @Body() body: any) {
    return this.service.addInterviewNote(id, body);
  }

  @ApiBearerAuth()
  @Post('candidates/:id/hire') @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Adayı işe al (Belge: Aday → çalışan dönüşümü)' })
  hire(@Param('id') id: string, @Body() body: any) {
    return this.service.hireCandidate(id, body);
  }

  @ApiBearerAuth()
  @Get('stats') @Roles(Role.HR, Role.ADMIN)
  stats() { return this.service.stats(); }
}

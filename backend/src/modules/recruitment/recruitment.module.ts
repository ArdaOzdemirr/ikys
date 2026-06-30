import { Module } from '@nestjs/common';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';
import { CvParserService } from './cv-parser.service';

@Module({
  controllers: [RecruitmentController],
  providers: [RecruitmentService, CvParserService],
})
export class RecruitmentModule {}

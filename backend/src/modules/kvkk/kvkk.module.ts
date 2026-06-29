import { Module } from '@nestjs/common';
import { KvkkController } from './kvkk.controller';
import { KvkkService } from './kvkk.service';

@Module({
  controllers: [KvkkController],
  providers: [KvkkService],
})
export class KvkkModule {}

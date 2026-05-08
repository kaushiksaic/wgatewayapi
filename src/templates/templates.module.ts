import { Module } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { MetaService } from './meta.service';

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService,MetaService]
})
export class TemplatesModule {}

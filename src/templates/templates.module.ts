import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { MetaService } from './meta.service';

@Module({
  imports: [AuthModule],
  controllers: [TemplatesController],
  providers: [TemplatesService,MetaService]
})
export class TemplatesModule {}

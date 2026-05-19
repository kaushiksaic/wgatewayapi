import {
  Body,
  Controller,
  Post,
  Put,
  Param,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtOrErpApiKeyGuard } from '../auth/guards/jwt-or-erp-api-key.guard';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { MapTemplateDto } from './dto/map-template.dto';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
    async createTemplate(
        @Body() createTemplateDto: CreateTemplateDto,
    ) {
        return this.templatesService.createTemplate(createTemplateDto);
    }


  @Put('update/:templateId')
  @UseGuards(JwtAuthGuard)
  async updateTemplate(
        @Param('templateId') templateId: string,
        @Body() updateTemplateDto: UpdateTemplateDto,
    ){
        return this.templatesService.updateTemplate(
            templateId,
            updateTemplateDto,
        )
    }

  @Post('submit/:templateId')
  @UseGuards(JwtAuthGuard)
  async submitTemplate(
        @Param('templateId') templateId: string,
    ) {
        return this.templatesService.submitTemplate(templateId);
    }

  @Post('map-to-partner')
  @UseGuards(JwtAuthGuard)
  async mapTemplateToPartner(
        @Body() mapTemplateDto: MapTemplateDto
    ) {
        return this.templatesService.mapTemplateToPartner(mapTemplateDto);
    }
  @Get()
  @UseGuards(JwtOrErpApiKeyGuard)
  async listTemplates(
        @Query('gatewayPartnerId') gatewayPartnerId?: string,
    ) {
        const partnerId =
            gatewayPartnerId && gatewayPartnerId !== 'all'
                ? Number(gatewayPartnerId)
                : undefined;
        return this.templatesService.listTemplates(partnerId);
    }

    /** @deprecated Use GET /templates?gatewayPartnerId= */
    @Get('partner/:erpPartnerId')
    async getTemplatesByPartner(
        @Param('erpPartnerId') erpPartnerId: string,
    ) {
        return this.templatesService.getTemplatesByPartner(erpPartnerId);
    }
}

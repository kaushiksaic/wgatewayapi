import { Body,Controller,Post,Put,Param } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { MapTemplateDto } from './dto/map-template.dto';

@Controller('templates')
export class TemplatesController {
    constructor(private readonly templatesService: TemplatesService) {}

    @Post('create')
    async createTemplate(
        @Body() createTemplateDto: CreateTemplateDto,
    ) {
        return this.templatesService.createTemplate(createTemplateDto);
    }


    @Put('update/:templateId')
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
    async submitTemplate(
        @Param('templateId') templateId: string,
    ) {
        return this.templatesService.submitTemplate(templateId);
    }

    @Post('map-to-partner')
    async mapTemplateToPartner(
        @Body() mapTemplateDto: MapTemplateDto
    ) {
        return this.templatesService.mapTemplateToPartner(mapTemplateDto);
    }
}

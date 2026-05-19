import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { CreateExternalMappingDto } from './dto/create-external-mapping.dto';
import { PartnersService } from './partners.service';

@Controller('partners')
@UseGuards(JwtAuthGuard)
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  async listPartners(@Query('activeOnly') activeOnly?: string) {
    const onlyActive = activeOnly !== 'false';
    return this.partnersService.listPartners(onlyActive);
  }

  @Post('create')
  async createPartner(@Body() createPartnerDto: CreatePartnerDto) {
    return this.partnersService.createPartner(createPartnerDto);
  }

  @Get('external-mappings')
  async listExternalMappings(@Query('activeOnly') activeOnly?: string) {
    const onlyActive = activeOnly !== 'false';
    return this.partnersService.listExternalMappings(onlyActive);
  }

  @Post('external-mappings/create')
  async createExternalMapping(@Body() dto: CreateExternalMappingDto) {
    return this.partnersService.createExternalMapping(dto);
  }

  @Post('external-mappings/deactivate/:mappingId')
  async deactivateExternalMapping(@Param('mappingId') mappingId: string) {
    return this.partnersService.deactivateExternalMapping(mappingId);
  }

}

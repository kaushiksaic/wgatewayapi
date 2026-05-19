import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtOrErpApiKeyGuard } from '../auth/guards/jwt-or-erp-api-key.guard';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SendBulkMessageDto } from './dto/send-bulk-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('send')
  @UseGuards(JwtOrErpApiKeyGuard)
  async sendMessage(
        @Body() sendMessageDto:SendMessageDto
    ) {
        return this.messagesService.sendMessage(sendMessageDto)
    }
  @Post('send-bulk')
  @UseGuards(JwtOrErpApiKeyGuard)
  async sendBulkMessage(
        @Body() sendBulkMessageDto:SendBulkMessageDto
    ){
        return this.messagesService.sendBulkMessage(sendBulkMessageDto)
    }
  @Get('status/:externalReferenceId')
  @UseGuards(JwtOrErpApiKeyGuard)
  async getMessageStatus(
        @Param('externalReferenceId')
        externalReferenceId:string
    ){
        return this.messagesService.getMessageStatus(externalReferenceId);
    }
  @Get('history')
  @UseGuards(JwtOrErpApiKeyGuard)
  async getMessageHistory(
        @Query('gatewayPartnerId') gatewayPartnerId?: string,
    ) {
        const partnerId =
            gatewayPartnerId && gatewayPartnerId !== 'all'
                ? Number(gatewayPartnerId)
                : undefined;
        return this.messagesService.getMessageHistory(partnerId);
    }

    /** @deprecated Use GET /messages/history?gatewayPartnerId= via ERP mapping */
    @Get('history/erp/:erpPartnerId')
    async getMessageHistoryByErp(
        @Param('erpPartnerId') erpPartnerId: string,
    ) {
        return this.messagesService.getMessageHistoryByErp(erpPartnerId);
    }
}

import { Controller,Get,Post,Query,Body,Res } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import type { Response } from 'express'

@Controller('webhooks')
export class WebhooksController {
    constructor(private readonly webhooksService: WebhooksService){}


    @Get('meta')
    verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') token: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ){
        const VERIFY_TOKEN = 'EDUSYNC_VERIFY_TOKEN'

         if (
      mode === 'subscribe' &&
      token === VERIFY_TOKEN
    ) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Verification failed');
  }


  @Post('meta')
  async receiveWebhook(
    @Body() body:any
  ) {
    return this.webhooksService.processWebhook(body);
  }
    
}

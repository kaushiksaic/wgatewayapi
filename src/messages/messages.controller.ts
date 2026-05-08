import { Body,Controller,Post } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('messages')
export class MessagesController {

    constructor(private readonly messagesService: MessagesService){}

    @Post('send')
    async sendMessage(
        @Body() sendMessageDto:SendMessageDto
    ) {
        return this.messagesService.sendMessage(sendMessageDto)
    }
}

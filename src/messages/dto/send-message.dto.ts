import { IsString,IsNumber,IsNotEmpty,IsOptional,IsObject,IsArray } from "class-validator";


export class SendMessageDto{
    @IsNumber()
    partnerId!:number

    @IsString()
    @IsNotEmpty()
    templateName!:string

    @IsString()
    @IsNotEmpty()
    to!:string;

    @IsObject()
    parameters!: Record<string,string>;
}
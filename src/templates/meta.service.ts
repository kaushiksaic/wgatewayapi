import { Injectable } from "@nestjs/common";
import axios from "axios";
import { response } from "express";
import { ConfigService } from "@nestjs/config";


@Injectable()
export class MetaService{

constructor(
    private configService:ConfigService
){}

async submitTemplate(payload:any){
    try{
         console.log(
        'META PAYLOAD:',
        JSON.stringify(payload, null, 2),
      );
        const BUSINESS_ID = this.configService.get<String>('BUSINESS_ID')
        const META_ACCESS_TOKEN = this.configService.get<String>('META_ACCESS_TOKEN')
        const response = await axios.post(
            `https://graph.facebook.com/v25.0/${BUSINESS_ID}/message_templates`,
            payload,
            {
                headers:{
                    Authorization: `Bearer ${META_ACCESS_TOKEN}`,
                    "Content-Type" : 'application/json'
                }
            }
        );

        

        return{
            success: true,
            data: response.data 
        };
    } catch(error:any){
        console.error(
        'META ERROR RESPONSE:',
        error?.response?.data || error.message,
      );
        return{
            success: false,
             error:
          error?.response?.data || error.message,
        }
    }
}
}
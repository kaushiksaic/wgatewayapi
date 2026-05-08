import { Injectable, OnModuleInit } from '@nestjs/common';
import * as sql from 'mssql';

@Injectable()
export class DatabaseService implements OnModuleInit {
  async onModuleInit() {
    try {
      const config: sql.config = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER as string,
        database: process.env.DB_NAME,
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
      };

      console.log('DB_SERVER:', process.env.DB_SERVER);

      await sql.connect(config);

      console.log('SQL Server Connected Successfully');
    } catch (error) {
      console.error('Database connection failed:', error);
    }
  }
}
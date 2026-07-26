import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { AuthExceptionFilter } from './common/filters/auth-exception.filter';

@Module({
  imports: [AuthModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AuthExceptionFilter,
    },
  ],
})
export class AppModule {}
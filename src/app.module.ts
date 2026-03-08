import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { WordsModule } from './words/words.module';
import { ProgressModule } from './progress/progress.module';

@Module({
  imports: [UsersModule, AuthModule, PrismaModule, WordsModule, ProgressModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

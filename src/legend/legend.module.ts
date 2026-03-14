import { Module } from '@nestjs/common';
import { LegendService } from './legend.service';
import { LegendController } from './legend.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LegendController],
  providers: [LegendService],
  exports: [LegendService],
})
export class LegendModule {}

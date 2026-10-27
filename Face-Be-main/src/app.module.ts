import { TrainingModule } from './training/training.module';
import { ScheduleModule } from './schedule/schedule.module';
import { CameraModule } from './camera/camera.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { StudentsModule } from './students/students.module';
import { RoomsModule } from './rooms/rooms.module';
import { RoomEventsModule } from './room-events/room-events.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [TrainingModule, ScheduleModule, CameraModule, DatabaseModule, AuthModule, StudentsModule, RoomsModule, RoomEventsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

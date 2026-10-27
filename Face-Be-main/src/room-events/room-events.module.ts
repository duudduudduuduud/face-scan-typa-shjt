import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { RoomsModule } from '../rooms/rooms.module';
import { RoomEventsController } from './room-events.controller';
import { RoomEventsService } from './room-events.service';

@Module({
  imports: [StudentsModule, RoomsModule],
  controllers: [RoomEventsController],
  providers: [RoomEventsService],
  exports: [RoomEventsService],
})
export class RoomEventsModule {}

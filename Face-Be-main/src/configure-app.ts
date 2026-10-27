import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureApp(app: INestApplication): void {
  app.enableCors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const config = new DocumentBuilder()
    .setTitle('FaceID Attendance API')
    .setDescription(
      'Quản lý sinh viên, phòng và lịch sử ra/vào. Tạo sinh viên và phòng trước, rồi dùng ID trả về để gửi sự kiện. Retry giữ nguyên eventKey; sự kiện mới dùng key mới.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    () => SwaggerModule.createDocument(app, config),
    {
      customSiteTitle: 'FaceID API — Swagger',
      swaggerOptions: { displayRequestDuration: true, validatorUrl: null },
    },
  );
}

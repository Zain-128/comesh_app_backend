import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import * as express from 'express';

// Polyfill SlowBuffer for Node 25+ compatibility with legacy libs
if (typeof global.SlowBuffer === 'undefined') {
  global.SlowBuffer = Buffer;
}

async function bootstrap() {
  await mkdir(join(process.cwd(), 'uploads', 'processed'), { recursive: true });

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      /** Required so @Transform (e.g. formJson for multipart niche / questionAndAnswers) runs. */
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
    }),
  );

  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  app.setGlobalPrefix('comesh/api');

  app.useWebSocketAdapter(new IoAdapter(app));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  Logger.log(`Server running on port ${port}`, 'Bootstrap');
}
bootstrap();

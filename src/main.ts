import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

// Polyfill SlowBuffer for Node 25+ compatibility with legacy libs
if (typeof global.SlowBuffer === 'undefined') {
  global.SlowBuffer = Buffer;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());

  // Use Socket.IO adapter for WebSocket gateways
  app.useWebSocketAdapter(new IoAdapter(app));

  await app.listen(3001);
  Logger.log(`Server running on port ${process.env.PORT || 3000}`, 'Bootstrap');
}
bootstrap();

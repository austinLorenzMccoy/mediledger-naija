import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.enableCors({
    origin: [process.env.FRONTEND_URL ?? 'https://mediledger-nigeria.vercel.app'],
    credentials: true,
  });

  await app.listen(3000);
  console.log('api-gateway running on port 3000');
}

bootstrap();

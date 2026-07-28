import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ZkVaultModule } from './zk-vault.module';

async function bootstrap() {
  const app = await NestFactory.create(ZkVaultModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api/v1');

  const port = parseInt(process.env.PORT ?? '3012');
  await app.listen(port);
  console.log(`zk-vault-service running on port ${port}`);
}

bootstrap();

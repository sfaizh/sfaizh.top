import { Global, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { API_CONFIG, loadConfig } from './config/config';
import { ContentModule } from './content/content.module';
import { MediaModule } from './media/media.module';

@Global()
@Module({
  providers: [{ provide: API_CONFIG, useFactory: () => loadConfig() }],
  exports: [API_CONFIG],
})
export class ConfigModule {}

@Module({
  imports: [ConfigModule, AuthModule, ContentModule, MediaModule],
})
export class AppModule {}

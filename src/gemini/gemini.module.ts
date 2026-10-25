import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GeminiClient } from './gemini-client';
import { HttpGeminiClient } from './http-gemini.client';

@Module({
  imports: [HttpModule],
  providers: [{ provide: GeminiClient, useClass: HttpGeminiClient }],
  exports: [GeminiClient],
})
export class GeminiModule {}

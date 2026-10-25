import { Test } from '@nestjs/testing';
import { GeminiClient } from './gemini-client';
import { GeminiModule } from './gemini.module';
import { HttpGeminiClient } from './http-gemini.client';
import { FileStorage } from '../storage/file-storage';
import { S3FileStorage } from '../storage/s3-file-storage';
import { StorageModule } from '../storage/storage.module';

describe('shared client modules', () => {
  it('provides the HTTP Gemini client and the S3 file storage behind their abstract tokens', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GeminiModule, StorageModule],
    }).compile();

    expect(moduleRef.get(GeminiClient)).toBeInstanceOf(HttpGeminiClient);
    expect(moduleRef.get(FileStorage)).toBeInstanceOf(S3FileStorage);
  });
});

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3FileStorage } from './s3-file-storage';
import { buildDatedImageKey, getImageExtension } from './image-key.util';

describe('S3FileStorage', () => {
  const savedEnv = {
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
  };
  let send: jest.SpyInstance;

  beforeEach(() => {
    process.env.AWS_REGION = 'ap-northeast-2';
    process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
    send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
  });

  afterEach(() => {
    send.mockRestore();
    Object.entries(savedEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  it('uploads with the request abort signal and returns the public URL', async () => {
    const storage = new S3FileStorage();
    const controller = new AbortController();
    const body = Buffer.from('x');

    const url = await storage.upload({
      key: 'meal/7/a.jpg',
      body,
      contentType: 'image/jpeg',
      abortSignal: controller.signal,
    });

    expect(url).toBe(
      'https://test-bucket.s3.ap-northeast-2.amazonaws.com/meal/7/a.jpg',
    );
    const [command, options] = send.mock.calls[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'test-bucket',
      Key: 'meal/7/a.jpg',
      Body: body,
      ContentType: 'image/jpeg',
    });
    expect(options).toEqual({ abortSignal: controller.signal });
  });

  it('propagates upload errors', async () => {
    send.mockRejectedValueOnce(new Error('s3 down'));
    const storage = new S3FileStorage();

    await expect(
      storage.upload({ key: 'k', body: Buffer.from(''), contentType: 'x' }),
    ).rejects.toThrow('s3 down');
  });

  it('deletes by key', async () => {
    const storage = new S3FileStorage();

    await storage.delete('meal/7/old');

    const [command] = send.mock.calls[0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: 'test-bucket', Key: 'meal/7/old' });
  });
});

describe('image key util', () => {
  it('maps image mime types to extensions', () => {
    expect(getImageExtension('image/jpeg')).toBe('jpg');
    expect(getImageExtension('image/jpg')).toBe('jpg');
    expect(getImageExtension('image/png')).toBe('png');
    expect(getImageExtension('image/webp')).toBe('webp');
    expect(getImageExtension('image/heic')).toBe('heic');
    expect(getImageExtension('application/pdf')).toBe('bin');
    expect(getImageExtension(undefined)).toBe('bin');
  });

  it('builds a dated key with a random name', () => {
    expect(buildDatedImageKey('chat-images/menu-board/7', 'image/png')).toMatch(
      /^chat-images\/menu-board\/7\/\d{8}\/[0-9a-z]{1,10}\.png$/,
    );
  });
});

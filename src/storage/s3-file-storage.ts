import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { FileStorage, FileUploadRequest } from './file-storage';

@Injectable()
export class S3FileStorage extends FileStorage {
  private readonly s3: S3Client;
  private readonly bucketName: string;

  constructor() {
    super();
    this.s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    this.bucketName = process.env.AWS_S3_BUCKET_NAME;
  }

  async upload(request: FileUploadRequest): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: request.key,
        Body: request.body,
        ContentType: request.contentType,
      }),
      { abortSignal: request.abortSignal },
    );

    return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${request.key}`;
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
  }
}

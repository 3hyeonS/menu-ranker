import { FileStorage, FileUploadRequest } from './file-storage';

// 테스트용 FileStorage. 업로드·삭제 요청을 기록하고, failNextUploadWith()로 오류를 주입한다.
export class FakeFileStorage extends FileStorage {
  readonly uploads: FileUploadRequest[] = [];
  readonly deletedKeys: string[] = [];
  private readonly uploadErrors: unknown[] = [];

  failNextUploadWith(error: unknown): this {
    this.uploadErrors.push(error);
    return this;
  }

  async upload(request: FileUploadRequest): Promise<string> {
    if (this.uploadErrors.length > 0) {
      throw this.uploadErrors.shift();
    }
    this.uploads.push(request);

    return `https://fake-bucket.s3.test.amazonaws.com/${request.key}`;
  }

  async delete(key: string): Promise<void> {
    this.deletedKeys.push(key);
  }
}

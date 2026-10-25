export type FileUploadRequest = {
  key: string;
  body: Buffer;
  contentType: string;
  // 넘기면 업로드 도중 요청이 취소될 때 같이 중단한다.
  abortSignal?: AbortSignal;
};

// 파일 업로드·삭제 저장소. Nest DI 토큰으로 쓰려고 interface 대신 abstract class로 둔다.
export abstract class FileStorage {
  // 업로드 후 공개 URL을 돌려준다.
  abstract upload(request: FileUploadRequest): Promise<string>;

  abstract delete(key: string): Promise<void>;
}

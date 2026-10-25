import { QueryFailedError } from 'typeorm';

// MySQL UNIQUE 제약 위반(ER_DUP_ENTRY, errno 1062)인지 확인한다.
export function isDuplicateEntryError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as
    | { code?: string; errno?: number }
    | undefined;

  return driverError?.code === 'ER_DUP_ENTRY' || driverError?.errno === 1062;
}

// 조회 후 없으면 insert하는 upsert가 동시 요청에 밀려 UNIQUE 충돌이 나면 한 번 더 실행한다.
// 두 번째 실행에서는 먼저 저장된 행을 조회해 갱신하므로 에러 대신 기존 행을 쓴다.
export async function retryOnceOnDuplicateEntry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isDuplicateEntryError(error)) {
      throw error;
    }

    return await operation();
  }
}

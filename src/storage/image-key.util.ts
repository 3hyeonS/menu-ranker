export function getImageExtension(mimeType?: string): string {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    default:
      return 'bin';
  }
}

// `<prefix>/<yyyyMMdd>/<랜덤 10자>.<확장자>` 형태의 업로드 키.
// 날짜는 기존 업로드 코드 그대로 toISOString(UTC) 기준이다.
export function buildDatedImageKey(prefix: string, mimeType?: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomString = Math.random().toString(36).substring(2, 12);

  return `${prefix}/${date}/${randomString}.${getImageExtension(mimeType)}`;
}

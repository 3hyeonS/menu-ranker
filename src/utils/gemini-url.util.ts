const DEFAULT_GEMINI_API_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta';
const MODEL_GENERATE_CONTENT_PATH_PATTERN = /\/models\/[^/]+:generateContent$/;

// GEMINI_BASE_URL(또는 GEMINI_IMAGE_BASE_URL)을 모델별 generateContent URL로 만든다.
// - 미설정: Google 기본 엔드포인트
// - API 베이스(예: https://proxy.example.com/v1beta): 뒤에 /models/{model}:generateContent를 붙인다
// - 특정 모델이 박힌 전체 URL(.../models/x:generateContent): 모델 부분만 현재 모델로 바꾼다
// 예전에는 설정값을 그대로 써서 fallback 모델로 넘어가도 같은 모델만 다시 호출했다.
export function buildGeminiGenerateContentUrl(
  model: string,
  baseUrlOverride?: string,
): string {
  const baseUrl =
    baseUrlOverride?.trim().replace(/\/+$/, '') || DEFAULT_GEMINI_API_BASE_URL;
  const modelPath = `/models/${model}:generateContent`;

  if (MODEL_GENERATE_CONTENT_PATH_PATTERN.test(baseUrl)) {
    return baseUrl.replace(MODEL_GENERATE_CONTENT_PATH_PATTERN, modelPath);
  }

  return `${baseUrl}${modelPath}`;
}

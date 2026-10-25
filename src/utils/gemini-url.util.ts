const MODEL_GENERATE_CONTENT_PATH_PATTERN = /\/models\/[^/]+:generateContent$/;

// GEMINI_BASE_URL(또는 GEMINI_IMAGE_BASE_URL)로 시도할 모델의 generateContent URL을 만든다.
// - 미설정: Google 기본 엔드포인트
// - `{model}`이 들어간 값: 시도하는 모델명으로 치환한다
// - .../models/<모델>:generateContent로 끝나는 값: 모델 부분만 시도하는 모델로 바꾼다
// - 그 밖의 값: 예전처럼 그대로 쓴다(모델을 URL로 고를 수 없는 프록시 엔드포인트 호환)
// 예전에는 설정값을 항상 그대로 써서 fallback 모델로 넘어가도 같은 모델만 다시 호출했다.
export function buildGeminiGenerateContentUrl(
  model: string,
  baseUrlOverride?: string,
): string {
  const baseUrl = baseUrlOverride?.trim();

  if (!baseUrl) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  if (baseUrl.includes('{model}')) {
    return baseUrl.split('{model}').join(model);
  }

  if (MODEL_GENERATE_CONTENT_PATH_PATTERN.test(baseUrl)) {
    return baseUrl.replace(
      MODEL_GENERATE_CONTENT_PATH_PATTERN,
      `/models/${model}:generateContent`,
    );
  }

  return baseUrl;
}

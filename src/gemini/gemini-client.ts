// 어떤 env 묶음으로 모델 목록·base URL을 고를지 정한다.
// - text: GEMINI_MODEL, GEMINI_FALLBACK_MODEL(S), GEMINI_BASE_URL
// - image: GEMINI_IMAGE_MODEL → GEMINI_MODEL, GEMINI_IMAGE_FALLBACK_MODEL(S), GEMINI_IMAGE_BASE_URL → GEMINI_BASE_URL
export type GeminiModelGroup = 'text' | 'image';

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type GeminiContent = {
  role: string; // 'user' | 'model'
  parts: GeminiPart[];
};

export type GeminiGenerateRequest = {
  modelGroup: GeminiModelGroup;
  systemInstruction?: string;
  contents: GeminiContent[];
  generationConfig: Record<string, unknown>;
  timeoutMs: number;
  // 지정하면 env 대신 이 모델만 순서대로 시도한다(고수요 대체 모델도 붙이지 않음). 대량 추정에서 모델을 고정할 때 쓴다.
  models?: string[];
  // 모든 모델이 실패했을 때 던지는 ServiceUnavailableException 메시지
  unavailableMessage: string;
  // 요청 취소가 아닌 시도 실패마다 호출된다(로그용). 없으면 아무것도 남기지 않는다.
  onAttemptError?: (
    error: unknown,
    attempt: { index: number; model: string },
  ) => void;
};

// 응답 usageMetadata 중 비용 계산에 쓰는 값. 응답에 없으면 null이다.
export type GeminiUsage = {
  promptTokenCount: number | null;
  candidatesTokenCount: number | null;
  totalTokenCount: number | null;
};

export type GeminiJsonResult<T> = {
  value: T;
  // 실제로 응답한 모델(fallback으로 넘어갔으면 그 모델).
  model: string;
  usage: GeminiUsage | null;
};

// Gemini generateContent 호출부. 모델 fallback, 요청 취소 전파, 취소 오류 재던지기를 구현체가 맡는다.
// Nest DI 토큰으로 쓰려고 interface 대신 abstract class로 둔다.
export abstract class GeminiClient {
  // 응답 parts의 text를 이어 붙여 trim한 문자열. 비어 있으면 실패로 보고 다음 모델로 넘어갈지 판단한다.
  abstract generateText(request: GeminiGenerateRequest): Promise<string>;

  // generateText 결과에서 코드 펜스를 지우고 JSON.parse한 값. 파싱 실패도 해당 모델의 실패로 처리한다.
  abstract generateJson<T = any>(request: GeminiGenerateRequest): Promise<T>;

  // generateJson과 같고, 응답한 모델과 토큰 사용량을 함께 돌려준다(대량 추정 비용 기록용, #41).
  abstract generateJsonWithUsage<T = any>(
    request: GeminiGenerateRequest,
  ): Promise<GeminiJsonResult<T>>;
}

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
  // 모든 모델이 실패했을 때 던지는 ServiceUnavailableException 메시지
  unavailableMessage: string;
  // 요청 취소가 아닌 시도 실패마다 호출된다(로그용). 없으면 아무것도 남기지 않는다.
  onAttemptError?: (
    error: unknown,
    attempt: { index: number; model: string },
  ) => void;
};

// Gemini generateContent 호출부. 모델 fallback, 요청 취소 전파, 취소 오류 재던지기를 구현체가 맡는다.
// Nest DI 토큰으로 쓰려고 interface 대신 abstract class로 둔다.
export abstract class GeminiClient {
  // 응답 parts의 text를 이어 붙여 trim한 문자열. 비어 있으면 실패로 보고 다음 모델로 넘어갈지 판단한다.
  abstract generateText(request: GeminiGenerateRequest): Promise<string>;

  // generateText 결과에서 코드 펜스를 지우고 JSON.parse한 값. 파싱 실패도 해당 모델의 실패로 처리한다.
  abstract generateJson<T = any>(request: GeminiGenerateRequest): Promise<T>;
}

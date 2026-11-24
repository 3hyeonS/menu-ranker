import { ServiceUnavailableException } from '@nestjs/common';
import {
  GeminiClient,
  GeminiGenerateRequest,
  GeminiJsonResult,
  GeminiUsage,
} from './gemini-client';

type FakeGeminiResponse =
  | { kind: 'text'; text: string; usage: GeminiUsage | null }
  | { kind: 'json'; value: unknown; usage: GeminiUsage | null }
  | { kind: 'error'; error: unknown }
  | { kind: 'unavailable' };

// 테스트용 GeminiClient. 넣어 둔 응답을 순서대로 돌려주고 받은 요청을 requests에 남긴다.
// 실제 구현이 모든 fallback 모델에서 실패(오류·타임아웃)했을 때의 결과는 failUnavailable()로,
// 요청 취소 등 특정 오류는 failWith()로 흉내 낸다.
export class FakeGeminiClient extends GeminiClient {
  readonly requests: GeminiGenerateRequest[] = [];
  private readonly responses: FakeGeminiResponse[] = [];

  // generateJsonWithUsage가 돌려주는 모델 이름.
  constructor(readonly model = 'fake-gemini') {
    super();
  }

  respondText(text: string, usage: GeminiUsage | null = null): this {
    this.responses.push({ kind: 'text', text, usage });
    return this;
  }

  respondJson(value: unknown, usage: GeminiUsage | null = null): this {
    this.responses.push({ kind: 'json', value, usage });
    return this;
  }

  // 남은 응답 수. 테스트가 넣은 응답을 모두 썼는지 확인할 때 쓴다.
  get pendingResponseCount(): number {
    return this.responses.length;
  }

  failWith(error: unknown): this {
    this.responses.push({ kind: 'error', error });
    return this;
  }

  failUnavailable(): this {
    this.responses.push({ kind: 'unavailable' });
    return this;
  }

  async generateText(request: GeminiGenerateRequest): Promise<string> {
    const response = this.next(request);

    return response.kind === 'json'
      ? JSON.stringify(response.value)
      : response.text;
  }

  async generateJson<T = any>(request: GeminiGenerateRequest): Promise<T> {
    return (await this.generateJsonWithUsage<T>(request)).value;
  }

  async generateJsonWithUsage<T = any>(
    request: GeminiGenerateRequest,
  ): Promise<GeminiJsonResult<T>> {
    const response = this.next(request);
    const value = (
      response.kind === 'text' ? JSON.parse(response.text) : response.value
    ) as T;

    return { value, model: this.model, usage: response.usage };
  }

  private next(
    request: GeminiGenerateRequest,
  ): Extract<FakeGeminiResponse, { kind: 'text' | 'json' }> {
    this.requests.push(request);
    const response = this.responses.shift();

    if (!response) {
      throw new Error('FakeGeminiClient has no queued response');
    }
    if (response.kind === 'error') {
      throw response.error;
    }
    if (response.kind === 'unavailable') {
      throw new ServiceUnavailableException(request.unavailableMessage);
    }

    return response;
  }
}

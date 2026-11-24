import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { buildGeminiGenerateContentUrl } from '../utils/gemini-url.util';
import {
  getRequestAbortSignal,
  isRequestCancellationError,
  throwIfRequestAborted,
} from '../utils/request-abort.util';
import {
  GeminiClient,
  GeminiGenerateRequest,
  GeminiJsonResult,
  GeminiModelGroup,
  GeminiUsage,
} from './gemini-client';

type GeminiResponseText = { text: string; usage: GeminiUsage | null };

function usageNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseGeminiUsage(value: unknown): GeminiUsage | null {
  if (value == null || typeof value !== 'object') {
    return null;
  }
  const usage = value as Record<string, unknown>;
  return {
    promptTokenCount: usageNumber(usage.promptTokenCount),
    candidatesTokenCount: usageNumber(usage.candidatesTokenCount),
    totalTokenCount: usageNumber(usage.totalTokenCount),
  };
}

const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash-lite'];
const DEFAULT_GEMINI_IMAGE_FALLBACK_MODELS = ['gemini-2.5-flash-lite'];
const GEMINI_HIGH_DEMAND_FALLBACK_MODEL = 'gemini-2.5-flash-lite';

export function stripGeminiCodeFence(value: string): string {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

// 404·429·5xx(500/503/504)·타임아웃일 때만 다음 모델로 넘어간다.
export function shouldRetryGeminiWithFallback(error: unknown): boolean {
  if (isRequestCancellationError(error)) {
    return false;
  }
  const geminiError = error as {
    code?: string;
    response?: {
      status?: number;
      data?: {
        error?: {
          status?: string;
        };
      };
    };
  };
  const httpStatus = geminiError.response?.status;
  const errorStatus = geminiError.response?.data?.error?.status;

  return (
    httpStatus === 404 ||
    httpStatus === 429 ||
    httpStatus === 500 ||
    httpStatus === 503 ||
    httpStatus === 504 ||
    errorStatus === 'NOT_FOUND' ||
    errorStatus === 'RESOURCE_EXHAUSTED' ||
    geminiError.code === 'ECONNABORTED'
  );
}

// 시도할 모델 순서: 기본 모델 → 설정된 fallback(없으면 기본 fallback) → 고수요 대체 모델, 중복 제거.
// env는 호출할 때마다 읽는다.
export function resolveGeminiModelAttempts(
  modelGroup: GeminiModelGroup,
): string[] {
  const env = process.env;
  const primaryModel =
    modelGroup === 'image'
      ? (env.GEMINI_IMAGE_MODEL ?? env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL)
      : (env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL);
  const fallbackListEnv =
    modelGroup === 'image'
      ? env.GEMINI_IMAGE_FALLBACK_MODELS
      : env.GEMINI_FALLBACK_MODELS;
  const fallbackEnv =
    modelGroup === 'image'
      ? env.GEMINI_IMAGE_FALLBACK_MODEL
      : env.GEMINI_FALLBACK_MODEL;
  const configuredFallbackModels = [
    ...(fallbackListEnv?.split(',').map((model) => model.trim()) ?? []),
    fallbackEnv,
  ];
  const hasConfiguredFallbackModels =
    fallbackListEnv !== undefined || fallbackEnv !== undefined;
  const fallbackModels = hasConfiguredFallbackModels
    ? configuredFallbackModels
    : modelGroup === 'image'
      ? DEFAULT_GEMINI_IMAGE_FALLBACK_MODELS
      : DEFAULT_GEMINI_FALLBACK_MODELS;

  return Array.from(
    new Set(
      [
        primaryModel,
        ...fallbackModels,
        GEMINI_HIGH_DEMAND_FALLBACK_MODEL,
      ].filter(
        (model): model is string =>
          typeof model === 'string' && model.trim().length > 0,
      ),
    ),
  );
}

function resolveGeminiBaseUrlOverride(
  modelGroup: GeminiModelGroup,
): string | undefined {
  return modelGroup === 'image'
    ? (process.env.GEMINI_IMAGE_BASE_URL ?? process.env.GEMINI_BASE_URL)
    : process.env.GEMINI_BASE_URL;
}

@Injectable()
export class HttpGeminiClient extends GeminiClient {
  constructor(private readonly httpService: HttpService) {
    super();
  }

  async generateText(request: GeminiGenerateRequest): Promise<string> {
    return (await this.generateWithFallback(request, (text) => text)).value;
  }

  async generateJson<T = any>(request: GeminiGenerateRequest): Promise<T> {
    return (await this.generateJsonWithUsage<T>(request)).value;
  }

  async generateJsonWithUsage<T = any>(
    request: GeminiGenerateRequest,
  ): Promise<GeminiJsonResult<T>> {
    return await this.generateWithFallback(
      request,
      (text) => JSON.parse(stripGeminiCodeFence(text)) as T,
    );
  }

  private async generateWithFallback<T>(
    request: GeminiGenerateRequest,
    parse: (text: string) => T,
  ): Promise<GeminiJsonResult<T>> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    const attempts = request.models?.length
      ? [...new Set(request.models)]
      : resolveGeminiModelAttempts(request.modelGroup);
    const baseUrlOverride = resolveGeminiBaseUrlOverride(request.modelGroup);

    for (const [index, model] of attempts.entries()) {
      const baseUrl = buildGeminiGenerateContentUrl(model, baseUrlOverride);

      try {
        throwIfRequestAborted();
        const { text, usage } = await this.postGenerateContent(
          `${baseUrl}?key=${apiKey}`,
          request,
        );

        // 파싱 실패도 이 모델의 실패로 보고 아래 catch에서 처리한다.
        return { value: parse(text), model, usage };
      } catch (error) {
        if (isRequestCancellationError(error)) {
          throw error;
        }
        request.onAttemptError?.(error, { index, model });

        if (
          index === attempts.length - 1 ||
          !shouldRetryGeminiWithFallback(error)
        ) {
          break;
        }
      }
    }

    throw new ServiceUnavailableException(request.unavailableMessage);
  }

  private async postGenerateContent(
    url: string,
    request: GeminiGenerateRequest,
  ): Promise<GeminiResponseText> {
    const response = await firstValueFrom(
      this.httpService.post(
        url,
        {
          ...(request.systemInstruction
            ? {
                system_instruction: {
                  parts: [{ text: request.systemInstruction }],
                },
              }
            : {}),
          contents: request.contents,
          generationConfig: request.generationConfig,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: request.timeoutMs,
          signal: getRequestAbortSignal(),
        },
      ),
    );

    throwIfRequestAborted();

    const text = response.data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      ?.trim();

    if (!text) {
      throw new Error('Gemini returned empty content');
    }

    return { text, usage: parseGeminiUsage(response.data?.usageMetadata) };
  }
}

import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { runWithRequestAbortSignal } from '../utils/request-abort.util';
import { GeminiGenerateRequest } from './gemini-client';
import { HttpGeminiClient } from './http-gemini.client';

const ENV_KEYS = [
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_FALLBACK_MODELS',
  'GEMINI_FALLBACK_MODEL',
  'GEMINI_BASE_URL',
  'GEMINI_IMAGE_MODEL',
  'GEMINI_IMAGE_FALLBACK_MODELS',
  'GEMINI_IMAGE_FALLBACK_MODEL',
  'GEMINI_IMAGE_BASE_URL',
];

const textResponse = (text: string) =>
  of({ data: { candidates: [{ content: { parts: [{ text }] } }] } });
// axios가 내는 오류 모양을 흉내 낸다.
const httpError = (status: number, errorStatus?: string) =>
  throwError(() => ({
    response: { status, data: { error: { status: errorStatus } } },
  }));
const timeoutError = () =>
  throwError(() => ({ code: 'ECONNABORTED', message: 'timeout' }));

// HttpService.post만 흉내 내는 가짜 전송 계층. 호출마다 넣어 둔 응답을 순서대로 돌려준다.
function createFakeHttp(...responses: Array<() => unknown>) {
  const post = jest.fn<unknown, [url: string, body: any, config: any]>(() => {
    const next = responses.shift();
    if (!next) {
      throw new Error('no queued response');
    }
    return next();
  });

  return { post };
}

const baseRequest = (
  overrides: Partial<GeminiGenerateRequest> = {},
): GeminiGenerateRequest => ({
  modelGroup: 'text',
  contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
  generationConfig: { temperature: 0.2 },
  timeoutMs: 12345,
  unavailableMessage: 'unavailable for test',
  ...overrides,
});

const calledModels = (post: jest.Mock) =>
  post.mock.calls.map(
    ([url]) => /models\/([^:]+):generateContent/.exec(url as string)?.[1],
  );

describe('HttpGeminiClient', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    });
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    });
  });

  it('throws before calling Gemini when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const http = createFakeHttp();
    const client = new HttpGeminiClient(http as never);

    await expect(client.generateText(baseRequest())).rejects.toThrow(
      new ServiceUnavailableException('GEMINI_API_KEY is not configured'),
    );
    expect(http.post).not.toHaveBeenCalled();
  });

  it('sends the request body, timeout and abort signal and returns trimmed text', async () => {
    const http = createFakeHttp(() => textResponse('  answer  '));
    const client = new HttpGeminiClient(http as never);
    const controller = new AbortController();

    const answer = await runWithRequestAbortSignal(controller.signal, () =>
      client.generateText(baseRequest({ systemInstruction: 'system' })),
    );

    expect(answer).toBe('answer');
    const [url, body, config] = http.post.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=test-key',
    );
    expect(body).toEqual({
      system_instruction: { parts: [{ text: 'system' }] },
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      generationConfig: { temperature: 0.2 },
    });
    expect(config).toEqual({
      headers: { 'Content-Type': 'application/json' },
      timeout: 12345,
      signal: controller.signal,
    });
  });

  it('omits system_instruction when no system instruction is given', async () => {
    const http = createFakeHttp(() => textResponse('ok'));
    const client = new HttpGeminiClient(http as never);

    await client.generateText(baseRequest());

    expect(http.post.mock.calls[0][1]).not.toHaveProperty('system_instruction');
  });

  it('parses JSON wrapped in a code fence', async () => {
    const http = createFakeHttp(() =>
      textResponse('```json\n{"menu_ids":[1,2]}\n```'),
    );
    const client = new HttpGeminiClient(http as never);

    await expect(client.generateJson(baseRequest())).resolves.toEqual({
      menu_ids: [1, 2],
    });
  });

  it.each([
    ['429', () => httpError(429)],
    ['503', () => httpError(503)],
    ['RESOURCE_EXHAUSTED', () => httpError(400, 'RESOURCE_EXHAUSTED')],
    ['timeout', timeoutError],
  ])(
    'falls back to the next model on %s and reports the failed attempt',
    async (_label, failure) => {
      process.env.GEMINI_MODEL = 'primary';
      process.env.GEMINI_FALLBACK_MODELS = 'fallback-a, fallback-b';
      const http = createFakeHttp(failure, () => textResponse('ok'));
      const client = new HttpGeminiClient(http as never);
      const onAttemptError = jest.fn();

      await expect(
        client.generateText(baseRequest({ onAttemptError })),
      ).resolves.toBe('ok');

      expect(calledModels(http.post)).toEqual(['primary', 'fallback-a']);
      expect(onAttemptError).toHaveBeenCalledTimes(1);
      expect(onAttemptError.mock.calls[0][1]).toEqual({
        index: 0,
        model: 'primary',
      });
    },
  );

  it('tries primary, configured fallbacks and the high-demand model once each, then gives up', async () => {
    process.env.GEMINI_MODEL = 'primary';
    process.env.GEMINI_FALLBACK_MODELS = 'fallback-a,primary';
    process.env.GEMINI_FALLBACK_MODEL = 'fallback-b';
    const http = createFakeHttp(timeoutError, timeoutError, timeoutError, () =>
      httpError(503),
    );
    const client = new HttpGeminiClient(http as never);
    const onAttemptError = jest.fn();

    await expect(
      client.generateText(baseRequest({ onAttemptError })),
    ).rejects.toThrow(new ServiceUnavailableException('unavailable for test'));

    expect(calledModels(http.post)).toEqual([
      'primary',
      'fallback-a',
      'fallback-b',
      'gemini-2.5-flash-lite',
    ]);
    expect(onAttemptError).toHaveBeenCalledTimes(4);
  });

  it.each([
    ['a non-retryable HTTP error', () => httpError(400)],
    ['empty content', () => textResponse('   ')],
  ])('does not fall back on %s', async (_label, failure) => {
    const http = createFakeHttp(failure, () => textResponse('unused'));
    const client = new HttpGeminiClient(http as never);

    await expect(client.generateText(baseRequest())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('treats invalid JSON as a failed attempt', async () => {
    const http = createFakeHttp(() => textResponse('not json'));
    const client = new HttpGeminiClient(http as never);
    const onAttemptError = jest.fn();

    await expect(
      client.generateJson(baseRequest({ onAttemptError })),
    ).rejects.toThrow('unavailable for test');
    expect(onAttemptError.mock.calls[0][0]).toBeInstanceOf(SyntaxError);
  });

  it('rethrows request cancellation without logging or falling back', async () => {
    const canceled = Object.assign(new Error('canceled'), {
      name: 'CanceledError',
    });
    const http = createFakeHttp(() => throwError(() => canceled));
    const client = new HttpGeminiClient(http as never);
    const onAttemptError = jest.fn();

    await expect(
      client.generateText(baseRequest({ onAttemptError })),
    ).rejects.toBe(canceled);
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(onAttemptError).not.toHaveBeenCalled();
  });

  it('does not call Gemini when the request is already aborted', async () => {
    const http = createFakeHttp(() => textResponse('unused'));
    const client = new HttpGeminiClient(http as never);
    const controller = new AbortController();
    controller.abort();

    await expect(
      runWithRequestAbortSignal(controller.signal, () =>
        client.generateText(baseRequest()),
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(http.post).not.toHaveBeenCalled();
  });

  describe('image model group', () => {
    it('prefers GEMINI_IMAGE_MODEL and image fallbacks over text settings', async () => {
      process.env.GEMINI_MODEL = 'text-model';
      process.env.GEMINI_FALLBACK_MODELS = 'text-fallback';
      process.env.GEMINI_IMAGE_MODEL = 'image-model';
      process.env.GEMINI_IMAGE_FALLBACK_MODEL = 'image-fallback';
      const http = createFakeHttp(
        () => httpError(404),
        () => textResponse('{}'),
      );
      const client = new HttpGeminiClient(http as never);

      await client.generateJson(baseRequest({ modelGroup: 'image' }));

      expect(calledModels(http.post)).toEqual([
        'image-model',
        'image-fallback',
      ]);
    });

    it('falls back to GEMINI_MODEL when GEMINI_IMAGE_MODEL is unset', async () => {
      process.env.GEMINI_MODEL = 'text-model';
      const http = createFakeHttp(() => textResponse('{}'));
      const client = new HttpGeminiClient(http as never);

      await client.generateJson(baseRequest({ modelGroup: 'image' }));

      expect(calledModels(http.post)).toEqual(['text-model']);
    });

    it('calls the fallback model even when GEMINI_BASE_URL is set', async () => {
      process.env.GEMINI_BASE_URL =
        'https://proxy.example.com/v1beta/models/{model}:generateContent';
      process.env.GEMINI_IMAGE_MODEL = 'primary-model';
      process.env.GEMINI_IMAGE_FALLBACK_MODELS = 'fallback-model';
      const http = createFakeHttp(
        () => httpError(429),
        () => textResponse('{"ok":true}'),
      );
      const client = new HttpGeminiClient(http as never);

      await expect(
        client.generateJson(baseRequest({ modelGroup: 'image' })),
      ).resolves.toEqual({ ok: true });

      expect(http.post.mock.calls.map(([url]) => url)).toEqual([
        'https://proxy.example.com/v1beta/models/primary-model:generateContent?key=test-key',
        'https://proxy.example.com/v1beta/models/fallback-model:generateContent?key=test-key',
      ]);
    });

    it('prefers GEMINI_IMAGE_BASE_URL over GEMINI_BASE_URL', async () => {
      process.env.GEMINI_BASE_URL = 'https://text.example.com/{model}';
      process.env.GEMINI_IMAGE_BASE_URL = 'https://image.example.com/{model}';
      process.env.GEMINI_IMAGE_MODEL = 'image-model';
      const http = createFakeHttp(() => textResponse('{}'));
      const client = new HttpGeminiClient(http as never);

      await client.generateJson(baseRequest({ modelGroup: 'image' }));

      expect(http.post.mock.calls[0][0]).toBe(
        'https://image.example.com/image-model?key=test-key',
      );
    });
  });
});

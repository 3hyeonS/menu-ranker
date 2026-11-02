import { ServiceUnavailableException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { FakeGeminiClient } from '../gemini/fake-gemini.client';
import { FakeFileStorage } from '../storage/fake-file-storage';
import { runWithRequestAbortSignal } from '../utils/request-abort.util';

const user = { id: 7 } as any;
const file = { buffer: Buffer.from('image'), mimetype: 'image/jpeg' } as any;

function createService() {
  const gemini = new FakeGeminiClient();
  const fileStorage = new FakeFileStorage();
  const service = Object.create(ChatService.prototype) as any;
  service.geminiClient = gemini;
  service.fileStorage = fileStorage;
  return { service, gemini, fileStorage };
}

describe('ChatService with GeminiClient', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('sends JSON prompts to the text model group with the caller options', async () => {
    const { service, gemini } = createService();
    gemini.respondJson({ ok: true });

    await expect(
      service.callGeminiJson('prompt', {
        context: 'meal-parse',
        timeoutMs: 7000,
        systemInstruction: 'system',
      }),
    ).resolves.toEqual({ ok: true });

    expect(gemini.requests[0]).toEqual(
      expect.objectContaining({
        modelGroup: 'text',
        systemInstruction: 'system',
        contents: [{ role: 'user', parts: [{ text: 'prompt' }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
        timeoutMs: 7000,
        unavailableMessage: 'Gemini recommendation pipeline is unavailable',
      }),
    );
  });

  it('logs failed attempts with the existing chat context labels', async () => {
    const { service, gemini } = createService();
    gemini.respondJson({});
    await service.callGeminiJson('prompt', { context: 'meal-parse' });
    const { onAttemptError } = gemini.requests[0];

    onAttemptError({ response: { status: 429 } }, { index: 0, model: 'a' });
    onAttemptError({ code: 'ECONNABORTED' }, { index: 1, model: 'b' });

    expect(consoleError.mock.calls.map(([, log]) => log.context)).toEqual([
      'meal-parse',
      'meal-parse-fallback:b',
    ]);
    expect(consoleError.mock.calls[1][1].networkCode).toBe('ECONNABORTED');
  });

  it('sends images with the chat system instruction to the image model group', async () => {
    const { service, gemini } = createService();
    gemini.respondJson({ foods: [] });

    await service.callGeminiJsonWithImage('prompt', file);

    const request = gemini.requests[0];
    expect(request.modelGroup).toBe('image');
    expect(request.systemInstruction).toEqual(expect.any(String));
    expect(request.timeoutMs).toBe(30000);
    expect(request.contents[0].parts[1]).toEqual({
      inline_data: { mime_type: 'image/jpeg', data: 'aW1hZ2U=' },
    });
  });

  it('propagates the unavailable error when every Gemini model fails', async () => {
    const { service, gemini } = createService();
    gemini.failUnavailable();

    await expect(service.callGeminiJson('prompt')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  describe('menu-board rematch fallback', () => {
    const recognition = { recognizedTexts: ['아메리카노'] };
    const candidates = [{ id: 1, name: '아메리카노' }];

    it('uses the Gemini selection when it succeeds', async () => {
      const { service, gemini } = createService();
      gemini.respondJson({ candidate_menu_ids: [1, 99] });

      await expect(
        service.rematchMenuBoardCandidatesWithGemini(recognition, candidates),
      ).resolves.toEqual(candidates);
    });

    it('returns no menus when every Gemini model fails or times out', async () => {
      const { service, gemini } = createService();
      gemini.failUnavailable();

      await expect(
        service.rematchMenuBoardCandidatesWithGemini(recognition, candidates),
      ).resolves.toEqual([]);
    });

    it('rethrows request cancellation instead of falling back', async () => {
      const { service, gemini } = createService();
      const canceled = Object.assign(new Error('canceled'), {
        name: 'CanceledError',
      });
      gemini.failWith(canceled);

      await expect(
        service.rematchMenuBoardCandidatesWithGemini(recognition, candidates),
      ).rejects.toBe(canceled);
    });
  });
});

describe('ChatService restaurant menu rankings', () => {
  const userContext = {
    user_profile: { goal: '감량' },
    long_term_profile_traits: null,
    recent_meal_records_3_days: [],
  };
  const menus = [1, 2, 3].map((id) => ({
    menu_id: id,
    menu_name: `메뉴 ${id}`,
    menu_category: '버거',
    calories: 100 * id,
    carbs: null,
    sugars: null,
    dietary_fiber: null,
    protein: null,
    fat: null,
    saturated_fat: null,
    sodium: null,
    unit: 0,
    weight: 200,
    unit_quantity: '1개',
  }));

  it('ranks all three filters in one deterministic Gemini call', async () => {
    const { service, gemini } = createService();
    gemini.respondJson({
      balanced: [2, 2, 99, '3'],
      low_calorie: [1, 2],
      protein: 'invalid',
    });

    await expect(
      service.rankRestaurantMenusByFilter({
        restaurantName: '테스트 버거',
        restaurantCategory: '버거',
        userContext,
        menus,
      }),
    ).resolves.toEqual({ 균형: [2, 3], 저칼로리: [1, 2], 단백질: [] });

    expect(gemini.requests).toHaveLength(1);
    expect(gemini.requests[0].generationConfig.temperature).toBe(0);
    const [part] = gemini.requests[0].contents[0].parts;
    const prompt = 'text' in part ? part.text : '';
    expect(prompt).toContain('"goal":"감량"');
    expect(prompt).not.toContain('recent_messages');
  });

  it('propagates Gemini failures so the caller can fall back', async () => {
    const { service, gemini } = createService();
    gemini.failUnavailable();

    await expect(
      service.rankRestaurantMenusByFilter({
        restaurantName: '테스트 버거',
        restaurantCategory: '버거',
        userContext,
        menus,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('ChatService with FileStorage', () => {
  it('uploads chat images under the image type prefix with the request abort signal', async () => {
    const { service, fileStorage } = createService();
    const controller = new AbortController();

    const url = await runWithRequestAbortSignal(controller.signal, () =>
      service.uploadChatImage(user, file, 'menu-board'),
    );

    expect(fileStorage.uploads[0].key).toMatch(
      /^chat-images\/menu-board\/7\/\d{8}\/[0-9a-z]+\.jpg$/,
    );
    expect(fileStorage.uploads[0].abortSignal).toBe(controller.signal);
    expect(url).toBe(
      `https://fake-bucket.s3.test.amazonaws.com/${fileStorage.uploads[0].key}`,
    );
  });

  it('keeps going when uploading a failed image also fails', async () => {
    const { service, fileStorage } = createService();
    fileStorage.failNextUploadWith(new Error('s3 down'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      service.uploadFailedChatImageIfPossible(
        user,
        file,
        'food-image-feedback',
        new Error('gemini failed'),
      ),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      '[CHAT] failed chat image upload failed',
      expect.objectContaining({ uploadErrorMessage: 's3 down' }),
    );
    warn.mockRestore();
  });

  it('uploads failed images without the request abort signal', async () => {
    const { service, fileStorage } = createService();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await service.uploadFailedChatImageIfPossible(
      user,
      file,
      'nutrition-label-feedback',
      new Error('gemini failed'),
    );

    expect(fileStorage.uploads[0].key).toMatch(
      /^chat-images\/failed\/nutrition-label-feedback\/7\/\d{8}\//,
    );
    expect(fileStorage.uploads[0].abortSignal).toBeUndefined();
    warn.mockRestore();
  });
});

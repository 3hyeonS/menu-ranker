import { ChatService } from './chat.service';
import { ChatHistoryEntity } from './entity/chat-history.entity';
import { of } from 'rxjs';

describe('ChatService conversation memory', () => {
  const createService = (httpService: unknown = {}): ChatService =>
    new ChatService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      httpService as never,
    );

  it('returns Gemini text without running the legacy recommendation pipeline', async () => {
    const service = createService() as any;
    const context = {
      messages: [],
      session_summaries: [],
      long_term_profile_traits: null,
      recent_meal_records_3_days: [],
      recent_workout_records_3_days: [],
      previous_user_input: null,
      previous_category: null,
      previous_recommended_menu_names: [],
      previous_feedback_menu_names: [],
      previous_brand: null,
      previous_category_name: null,
      previous_meal_time: null,
    };
    service.chatHistoryRepository = {
      create: jest.fn((value) => value),
    };
    const userInfo = {
      goal: 0,
      target_ratio: [40, 30, 30],
    };
    jest.spyOn(service, 'getRequiredUserInfo').mockResolvedValue(userInfo);
    jest.spyOn(service, 'getRecentChatContext').mockResolvedValue(context);
    jest
      .spyOn(service, 'callGeminiText')
      .mockResolvedValue('제미나이 원문 답변');
    jest.spyOn(service, 'saveNewChatHistory').mockResolvedValue({});
    const legacyPipeline = jest.spyOn(service, 'recommendWithLegacyPipeline');

    const response = await service.recommend(
      { id: 9 },
      { input: ' 이전 얘기 이어서 답해줘 ' },
    );

    expect(response).toEqual({
      chat_category: 'general',
      intro_message: '제미나이 원문 답변',
    });
    expect(response).not.toHaveProperty('general_answer');
    expect(response).not.toHaveProperty('recommendations');
    expect(response).not.toHaveProperty('feedback');
    expect(service.callGeminiText).toHaveBeenCalledWith(
      '이전 얘기 이어서 답해줘',
      context,
      userInfo,
    );
    expect(legacyPipeline).not.toHaveBeenCalled();
  });

  it('sends user info, records, and past chat to pure Gemini chat', async () => {
    const post = jest.fn((_url: string, _body: Record<string, any>) =>
      of({
        data: {
          candidates: [{ content: { parts: [{ text: '이어진 답변' }] } }],
        },
      }),
    );
    const service = createService({ post }) as any;
    const previousApiKey = process.env.GEMINI_API_KEY;
    const previousModel = process.env.GEMINI_MODEL;
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'test-model';

    try {
      const answer = await service.callGeminiText(
        '현재 질문',
        {
          messages: [
            {
              user_input: '이전 질문',
              chat_category: 'general',
              intro_message: '이전 답변',
              image_summary: null,
              recommended_menu_names: [],
              feedback_menu_names: [],
              desired_brand: null,
              desired_category: null,
              meal_time: null,
            },
          ],
          session_summaries: [],
          long_term_profile_traits: null,
          recent_meal_records_3_days: [{ menus: [{ name: '닭가슴살' }] }],
          recent_workout_records_3_days: [{ workout_name: '스쿼트' }],
        },
        {
          gender: 0,
          birthYear: 1995,
          height: 170,
          weight: 65,
          activity: 1,
          goal: 0,
          target_weight: 60,
          target_calories: 1800,
          target_ratio: [40, 30, 30],
        },
      );

      expect(answer).toBe('이어진 답변');
      const requestBody = post.mock.calls[0][1];
      expect(requestBody.contents).toEqual([
        { role: 'user', parts: [{ text: '이전 질문' }] },
        { role: 'model', parts: [{ text: '이전 답변' }] },
        { role: 'user', parts: [{ text: '현재 질문' }] },
      ]);
      expect(JSON.stringify(requestBody)).toContain('닭가슴살');
      expect(JSON.stringify(requestBody)).toContain('스쿼트');
      expect(JSON.stringify(requestBody)).toContain('target_calories');
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = previousApiKey;
      }
      if (previousModel === undefined) {
        delete process.env.GEMINI_MODEL;
      } else {
        process.env.GEMINI_MODEL = previousModel;
      }
    }
  });

  it('does not treat recommendation cards as confirmed consumption', () => {
    const service = createService() as any;
    const history = {
      input_text: '저녁 추천해줘',
      response_payload: {
        chat_category: 'recommendation',
        recommendations: [{ menu_id: 1, menu_name: '(식약처_음식)비빔밥' }],
      },
      meal_record: null,
    } as unknown as ChatHistoryEntity;

    const item = service.toConversationSummaryTranscriptItem(history);

    expect(item.suggested_menu_names_not_consumed).toEqual(['비빔밥']);
    expect(item.confirmed_meal_record).toBeNull();
  });

  it('includes only an explicit meal record as confirmed consumption', () => {
    const service = createService() as any;
    const history = {
      input_text: '이걸로 기록할게',
      response_payload: {
        chat_category: 'feedback',
        feedback: {
          menus: [{ menu_id: 7, menu_name: '(식약처_음식)닭가슴살' }],
        },
      },
      meal_record: {
        time: 2,
        menu_ids: [7],
        menu_quantities: [120],
        menu_input_modes: [0],
      },
    } as unknown as ChatHistoryEntity;

    const item = service.toConversationSummaryTranscriptItem(history);

    expect(item.confirmed_meal_record).toEqual({
      time: 2,
      menus: [
        {
          menu_id: 7,
          menu_name: '닭가슴살',
          quantity_g: 120,
        },
      ],
    });
  });

  it('injects session summaries and long-term traits into Gemini context', () => {
    const service = createService() as any;
    const lightweightContext = service.toLightweightChatContext({
      messages: [],
      session_summaries: [
        {
          started_at: '2026-08-20T00:00:00.000Z',
          ended_at: '2026-08-20T01:00:00.000Z',
          summary: '사용자는 매운 음식을 피했어.',
        },
      ],
      long_term_profile_traits: '반복적으로 매운 음식을 선호하지 않았어.',
      recent_meal_records_3_days: [],
      recent_workout_records_3_days: [],
      previous_user_input: null,
      previous_category: null,
      previous_recommended_menu_names: [],
      previous_feedback_menu_names: [],
      previous_brand: null,
      previous_category_name: null,
      previous_meal_time: null,
    });

    expect(lightweightContext.session_summaries).toHaveLength(1);
    expect(lightweightContext.long_term_profile_traits).toContain('매운 음식');
    expect(lightweightContext.recent_meal_records_3_days).toEqual([]);
    expect(lightweightContext.recent_workout_records_3_days).toEqual([]);
    expect(lightweightContext.consumption_interpretation).toContain(
      '실제 섭취가 아니다',
    );
  });

  it('uses today and the previous two calendar days for record context', () => {
    const service = createService() as any;
    const referenceDate = new Date(2026, 7, 24, 12, 30, 0);

    const range = service.getRecentRecordDateRange(referenceDate);

    expect(service.formatLocalDate(range.start)).toBe('2026-08-22');
    expect(service.formatLocalDate(range.end)).toBe('2026-08-24');
    expect(range.start.getHours()).toBe(0);
    expect(range.end.getHours()).toBe(23);
  });
});

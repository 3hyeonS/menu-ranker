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
      recent_weight_records_7_days: [],
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
    jest.spyOn(service, 'formatKoreaDate').mockReturnValue('2026-08-28');

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
          recent_meal_records_3_days: [
            {
              date: '2026-08-28',
              meal_time: 2,
              meal_time_label: '저녁',
              menus: [
                {
                  name: '닭가슴살',
                  quantity: 1,
                  quantity_unit: '인분',
                  input_mode: 0,
                  consumed_nutrition: {
                    calories: 150,
                    carbs: 2,
                    protein: 30,
                    fat: 3,
                    sugars: 0,
                    dietary_fiber: 0,
                    sodium: 300,
                  },
                },
              ],
              nutrition_totals: {
                calories: 150,
                carbs: 2,
                protein: 30,
                fat: 3,
                sugars: 0,
                dietary_fiber: 0,
                sodium: 300,
              },
            },
          ],
          recent_workout_records_3_days: [{ workout_name: '스쿼트' }],
          recent_weight_records_7_days: [
            { date: '2026-08-28', weight_kg: 64.3 },
          ],
        },
        {
          user: { nickname: '튼튼이' },
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
        '현재 업로드된 음식 사진 분석 결과: 닭가슴살과 샐러드',
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
      expect(JSON.stringify(requestBody)).toContain('64.3');
      expect(JSON.stringify(requestBody)).toContain('target_calories');
      expect(JSON.stringify(requestBody)).toContain('같은 음식 문화권');
      expect(JSON.stringify(requestBody)).toContain('태국 음식을 먹었다면');
      const systemInstruction = requestBody.system_instruction.parts[0]
        .text as string;
      expect(systemInstruction).toContain(
        '"nickname":"튼튼이","preferred_address":"튼튼이님"',
      );
      expect(systemInstruction).toContain('"recorded_meal_slots":["저녁"]');
      expect(systemInstruction).toContain(
        '저녁이 남아 있다고 전제하는 표현을 절대 쓰지 마',
      );
      expect(systemInstruction).toContain(
        '"date":"2026-08-27","weekday":"목요일"',
      );
      expect(systemInstruction).toContain(
        '"date":"2026-08-28","weekday":"금요일"',
      );
      expect(systemInstruction).toContain(
        '모든 답변은 친구에게 말하듯 자연스럽고 친근한 반말 해체',
      );
      expect(systemInstruction).toContain(
        '과거 대화의 assistant 답변이 존댓말이어도 말투는 따라 하지 말고',
      );
      expect(systemInstruction).toContain(
        '과거 assistant 답변은 AI가 생성한 조언이나 추론일 뿐이며',
      );
      expect(systemInstruction).toContain(
        '"사용자님", "고객님", "회원님" 같은 일반 호칭은 절대 쓰지 마',
      );
      expect(systemInstruction).toContain('건더기 위주로 먹어');
      expect(systemInstruction).toContain('사용자 습관이나 목표로 표현하지 마');
      expect(systemInstruction).toContain('최근 3일 일별 영양 합계');
      expect(systemInstruction).toContain('최근 7일 체중 기록');
      expect(systemInstruction).toContain(
        '현재 요청 추가 맥락:\n현재 업로드된 음식 사진 분석 결과: 닭가슴살과 샐러드',
      );
      expect(systemInstruction).toContain(
        '이미 합계가 있으면 "예상", "추정", "~로 보임"이라고 표현하지 마',
      );
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

  it('calculates the weekday for a date without asking Gemini', () => {
    const service = createService() as any;

    expect(service.getKoreanWeekday('2026-08-25')).toBe('화요일');
    expect(service.getKoreanWeekday('2026-08-26')).toBe('수요일');
  });

  it('calculates recorded nutrition using the saved quantity mode', () => {
    const service = createService() as any;
    const menu = {
      weight: 200,
      calories: 400,
      carbs: 50,
      protein: 20,
      fat: 10,
      sugars: 8,
      dietary_fiber: 6,
      sodium: 500,
    };

    expect(service.calculateRecordedMenuNutrition(menu, 100, 1)).toEqual({
      calories: 200,
      carbs: 25,
      protein: 10,
      fat: 5,
      sugars: 4,
      dietary_fiber: 3,
      sodium: 250,
    });
    expect(service.calculateRecordedMenuNutrition(menu, 2, 0)).toEqual({
      calories: 800,
      carbs: 100,
      protein: 40,
      fat: 20,
      sugars: 16,
      dietary_fiber: 12,
      sodium: 1000,
    });
  });

  it('generates the food image intro through the pure text chat path', async () => {
    const service = createService() as any;
    const callGeminiText = jest
      .spyOn(service, 'callGeminiText')
      .mockResolvedValue('사진 식사에 대한 순수 답변');
    const chatContext = { messages: [] };
    const userInfo = { user: { nickname: '튼튼이' } };

    const result = await service.generateFoodImagePureIntroMessage({
      userInfo,
      chatContext,
      imageSummary: '닭가슴살과 샐러드가 담긴 접시',
      recognizedFoods: [
        {
          name: '닭가슴살',
          category: '육류',
          confidence: 0.9,
        },
      ],
      feedback: {
        menus: [],
        total_calories: 250,
        score: 80,
        is_appropriate: true,
      },
    });

    expect(result).toBe('사진 식사에 대한 순수 답변');
    expect(callGeminiText).toHaveBeenCalledWith(
      '이 사진 속 식사 구성을 분석해줘.',
      chatContext,
      userInfo,
      expect.stringContaining('닭가슴살과 샐러드가 담긴 접시'),
    );
    expect(callGeminiText.mock.calls[0][3]).toContain(
      '아직 사용자가 먹었다거나 식사 기록을 완료했다는 뜻은 아니다',
    );
  });

  it('ignores legacy long-term traits without explicit user provenance', () => {
    const service = createService() as any;

    expect(
      service.normalizeVerifiedProfileTraits(
        '건더기 위주로 먹고 저칼로리 식이섬유 식품을 목표로 함',
      ),
    ).toBeNull();
    expect(
      service.normalizeVerifiedProfileTraits(
        '사용자 직접 진술: 매운 음식을 선호하지 않음',
      ),
    ).toBe('사용자 직접 진술: 매운 음식을 선호하지 않음');
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
      recent_weight_records_7_days: [],
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
    expect(lightweightContext.recent_weight_records_7_days).toEqual([]);
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

  it('uses today and the previous six calendar days for weight context', () => {
    const service = createService() as any;
    const referenceDate = new Date(2026, 7, 24, 12, 30, 0);

    const range = service.getRecentRecordDateRange(referenceDate, 7);

    expect(service.formatLocalDate(range.start)).toBe('2026-08-18');
    expect(service.formatLocalDate(range.end)).toBe('2026-08-24');
  });
});

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
      recent_step_records_7_days: [],
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
    const menstrualContext = jest.spyOn(
      service,
      'getMenstrualManagementContext',
    );
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
    expect(menstrualContext).not.toHaveBeenCalled();
    expect(legacyPipeline).not.toHaveBeenCalled();
  });

  it('adds all menstrual cycle phases to regular chat for trial users', async () => {
    const service = createService() as any;
    const chatContext = {
      messages: [],
      session_summaries: [],
      long_term_profile_traits: null,
      recent_meal_records_3_days: [],
      recent_workout_records_3_days: [],
      recent_weight_records_7_days: [],
      recent_step_records_7_days: [],
      previous_user_input: null,
      previous_category: null,
      previous_recommended_menu_names: [],
      previous_feedback_menu_names: [],
      previous_brand: null,
      previous_category_name: null,
      previous_meal_time: null,
    };
    const userInfo = { goal: 0, target_ratio: [40, 30, 30] };
    const menstrualContext = {
      reference_date: '2026-09-15',
      data_available: true,
      recorded_cycle_count: 1,
      cycle_length_days: 28,
      cycle_length_source: 'default_28_days',
      normal_cycle_intervals_used: [],
      cycles: [
        {
          cycle_number: 1,
          recording_status: 'completed',
          end_date_confirmed: true,
          recorded_menstrual_period: {
            start_date: '2026-08-18',
            end_date: '2026-08-22',
          },
          menstrual_phase: {
            start_date: '2026-08-18',
            end_date: '2026-08-22',
          },
          follicular_phase: {
            start_date: '2026-08-23',
            end_date: '2026-08-29',
          },
          ovulation_phase: {
            start_date: '2026-08-30',
            end_date: '2026-09-01',
          },
          luteal_phase: {
            start_date: '2026-09-02',
            end_date: '2026-09-14',
          },
        },
      ],
      latest_cycle_ongoing: false,
      latest_cycle_end_date_confirmed: true,
      current_phase: null,
      current_phase_starts_today: false,
      next_phase: null,
      next_phase_starts_today: false,
      next_expected_menstrual_date: '2026-09-15',
    };
    service.chatHistoryRepository = {
      create: jest.fn((value) => value),
    };
    jest.spyOn(service, 'getRequiredUserInfo').mockResolvedValue(userInfo);
    jest.spyOn(service, 'getRecentChatContext').mockResolvedValue(chatContext);
    jest
      .spyOn(service, 'getMenstrualManagementContext')
      .mockResolvedValue(menstrualContext);
    const callGemini = jest
      .spyOn(service, 'callGeminiText')
      .mockResolvedValue('월경 기록이 반영된 답변');
    jest.spyOn(service, 'saveNewChatHistory').mockResolvedValue({});

    const response = await service.recommend(
      { id: 42 },
      { input: '오늘 운동은 어떻게 할까?' },
    );

    expect(callGemini).toHaveBeenCalledWith(
      '오늘 운동은 어떻게 할까?',
      chatContext,
      userInfo,
      expect.stringContaining('체험 신청자 일반 채팅에 제공되는 월경 기록'),
    );
    const requestContext = callGemini.mock.calls[0][3];
    expect(requestContext).toContain('menstrual_phase');
    expect(requestContext).toContain('follicular_phase');
    expect(requestContext).toContain('ovulation_phase');
    expect(requestContext).toContain('luteal_phase');
    expect(requestContext).toContain('2026-09-15');
    expect(response).toEqual({
      chat_category: 'general',
      intro_message: '월경 기록이 반영된 답변',
    });
  });

  it('handles app feature questions without restoring the legacy pipeline', async () => {
    const service = createService() as any;
    service.chatHistoryRepository = {
      create: jest.fn((value) => value),
    };
    const userInfo = jest.spyOn(service, 'getRequiredUserInfo');
    const chatContext = jest.spyOn(service, 'getRecentChatContext');
    const gemini = jest.spyOn(service, 'callGeminiText');
    const legacyPipeline = jest.spyOn(service, 'recommendWithLegacyPipeline');
    jest.spyOn(service, 'saveNewChatHistory').mockResolvedValue({});

    const response = await service.recommend(
      { id: 9 },
      { input: '식사 기록은 앱에서 어떻게 해?' },
    );

    expect(response.chat_category).toBe('general');
    expect(response.intro_message).toContain(
      '[설정 - 문의하기/아이디어 보내기]',
    );
    expect(response).not.toHaveProperty('general_answer');
    expect(response).not.toHaveProperty('recommendations');
    expect(response).not.toHaveProperty('feedback');
    expect(userInfo).not.toHaveBeenCalled();
    expect(chatContext).not.toHaveBeenCalled();
    expect(gemini).not.toHaveBeenCalled();
    expect(legacyPipeline).not.toHaveBeenCalled();
  });

  it('rejects personalized management for users outside the trial group', async () => {
    const service = createService() as any;

    await expect(service.personalizedManagement({ id: 41 })).rejects.toThrow(
      'Personalized management is available only to trial participants',
    );
  });

  it('uses expanded record periods only for personalized management', async () => {
    const service = createService() as any;
    const chatContext = {
      messages: [],
      session_summaries: [],
      long_term_profile_traits: null,
      recent_meal_records_3_days: [],
      recent_workout_records_3_days: [],
      recent_weight_records_7_days: [],
      recent_step_records_7_days: [],
      record_context_days: { meals: 7, workouts: 7, weights: 30, steps: 7 },
      previous_user_input: null,
      previous_category: null,
      previous_recommended_menu_names: [],
      previous_feedback_menu_names: [],
      previous_brand: null,
      previous_category_name: null,
      previous_meal_time: null,
    };
    const menstrualContext = {
      reference_date: '2026-09-10',
      data_available: false,
      recorded_cycle_count: 0,
      cycle_length_days: null,
      cycle_length_source: null,
      normal_cycle_intervals_used: [],
      cycles: [],
      latest_cycle_ongoing: false,
      latest_cycle_end_date_confirmed: null,
      current_phase: null,
      current_phase_starts_today: false,
      next_phase: null,
      next_phase_starts_today: false,
      next_expected_menstrual_date: null,
    };
    const userInfo = { goal: 0, target_ratio: [40, 30, 30] };
    const getChatContext = jest
      .spyOn(service, 'getRecentChatContext')
      .mockResolvedValue(chatContext);
    jest.spyOn(service, 'getRequiredUserInfo').mockResolvedValue(userInfo);
    jest
      .spyOn(service, 'getMenstrualManagementContext')
      .mockResolvedValue(menstrualContext);
    jest
      .spyOn(service, 'getRecentPersonalizedManagementFeedback')
      .mockResolvedValue([
        {
          created_at: '2026-09-09T10:00:00+09:00',
          intro_message: '이전에 제공한 관리법',
        },
      ]);
    const callGemini = jest
      .spyOn(service, 'callGeminiText')
      .mockResolvedValue('개인화된 관리법');
    service.chatHistoryRepository = {
      create: jest.fn((value) => value),
    };
    jest.spyOn(service, 'saveNewChatHistory').mockResolvedValue({});

    const response = await service.personalizedManagement({ id: 42 });

    expect(getChatContext).toHaveBeenCalledWith(42, 8, {
      meals: 7,
      workouts: 7,
      weights: 30,
      steps: 7,
    });
    expect(callGemini).toHaveBeenCalledWith(
      '나에게 맞는 관리법을 알려줘',
      chatContext,
      userInfo,
      expect.stringContaining('개인화 관리법 생성 규칙'),
    );
    expect(callGemini.mock.calls[0][3]).toContain(
      '최근에 이 기능으로 제공한 관리 피드백',
    );
    expect(callGemini.mock.calls[0][3]).toContain('이전에 제공한 관리법');
    expect(callGemini.mock.calls[0][3]).toContain(
      '실제 기록된 음식명을 최소 하나 이상 언급',
    );
    expect(callGemini.mock.calls[0][3]).toContain('총 6~8문장까지');
    expect(response).toEqual({
      chat_category: 'general',
      intro_message: '개인화된 관리법',
    });
  });

  it('creates selected-date meal feedback with the server-calculated score', async () => {
    const service = createService() as any;
    const chatContext = {
      messages: [],
      session_summaries: [],
      long_term_profile_traits: null,
      recent_meal_records_3_days: [],
      recent_workout_records_3_days: [],
      recent_weight_records_7_days: [],
      recent_step_records_7_days: [],
      previous_user_input: null,
      previous_category: null,
      previous_recommended_menu_names: [],
      previous_feedback_menu_names: [],
      previous_brand: null,
      previous_category_name: null,
      previous_meal_time: null,
    };
    const mealRecords = [
      {
        date: '2026-09-12',
        meal_time: 0,
        meal_time_label: '아침',
        menus: [
          {
            name: '밥',
            quantity: 100,
            quantity_unit: 'g',
            input_mode: 1,
            input_mode_label: '중량 탭',
            consumed_nutrition: {
              calories: 500,
              carbs: 96,
              protein: 21,
              fat: 4,
              sugars: 2,
              dietary_fiber: 1,
              sodium: 20,
            },
          },
        ],
        nutrition_totals: {
          calories: 500,
          carbs: 96,
          protein: 21,
          fat: 4,
          sugars: 2,
          dietary_fiber: 1,
          sodium: 20,
        },
      },
    ];
    const userInfo = {
      target_calories: 1200,
      target_ratio: [50, 20, 30],
    };
    jest.spyOn(service, 'getRequiredUserInfo').mockResolvedValue(userInfo);
    jest.spyOn(service, 'getRecentChatContext').mockResolvedValue(chatContext);
    jest
      .spyOn(service, 'getMealRecordContextForDate')
      .mockResolvedValue(mealRecords);
    jest.spyOn(service, 'getBurnedCaloriesForDate').mockResolvedValue(100);
    const callGemini = jest
      .spyOn(service, 'callGeminiText')
      .mockResolvedValue('선택 날짜 식사 피드백');
    service.chatHistoryRepository = {
      create: jest.fn((value) => value),
    };
    jest.spyOn(service, 'saveNewChatHistory').mockResolvedValue({});

    const response = await service.mealFeedback(
      { id: 9 },
      { date: '2026-09-12' },
    );

    expect(callGemini).toHaveBeenCalledWith(
      '2026-09-12 식사 피드백을 알려줘',
      chatContext,
      userInfo,
      expect.stringContaining('"score":36'),
    );
    expect(callGemini.mock.calls[0][3]).toContain('"name":"밥"');
    expect(callGemini.mock.calls[0][3]).toContain(
      '"exercise_burned_calories":100',
    );
    expect(callGemini.mock.calls[0][3]).toContain(
      '"adjusted_target_calories":1300',
    );
    expect(callGemini.mock.calls[0][3]).toContain(
      'selected_date의 식사만 분석해',
    );
    expect(response).toEqual({
      chat_category: 'general',
      intro_message: '선택 날짜 식사 피드백',
    });
  });

  it('does not generate meal feedback when the selected date has no meals', async () => {
    const service = createService() as any;
    jest.spyOn(service, 'getRequiredUserInfo').mockResolvedValue({});
    jest.spyOn(service, 'getRecentChatContext').mockResolvedValue({});
    jest.spyOn(service, 'getMealRecordContextForDate').mockResolvedValue([]);
    jest.spyOn(service, 'getBurnedCaloriesForDate').mockResolvedValue(0);

    await expect(
      service.mealFeedback({ id: 9 }, { date: '2026-09-12' }),
    ).rejects.toThrow('Meal record not found for selected date');
  });

  it('applies every calorie-difference score band from the service policy', () => {
    const service = createService() as any;

    expect(service.getMealFeedbackCalorieScore(5)).toBe(50);
    expect(service.getMealFeedbackCalorieScore(5.1)).toBe(40);
    expect(service.getMealFeedbackCalorieScore(10.1)).toBe(30);
    expect(service.getMealFeedbackCalorieScore(15.1)).toBe(20);
    expect(service.getMealFeedbackCalorieScore(20.1)).toBe(10);
  });

  it('applies the policy-specific macro scores for carbs, protein, and fat', () => {
    const service = createService() as any;

    expect(service.buildMealFeedbackMacroScoreItem(100, 50, 50, 17).score).toBe(
      17,
    );
    expect(service.buildMealFeedbackMacroScoreItem(100, 56, 50, 17).score).toBe(
      14,
    );
    expect(service.buildMealFeedbackMacroScoreItem(100, 61, 50, 17).score).toBe(
      10,
    );
    expect(service.buildMealFeedbackMacroScoreItem(100, 66, 50, 17).score).toBe(
      5,
    );
    expect(service.buildMealFeedbackMacroScoreItem(100, 50, 50, 16).score).toBe(
      16,
    );
    expect(service.buildMealFeedbackMacroScoreItem(100, 56, 50, 16).score).toBe(
      13,
    );
    expect(service.buildMealFeedbackMacroScoreItem(100, 61, 50, 16).score).toBe(
      9,
    );
    expect(service.buildMealFeedbackMacroScoreItem(100, 66, 50, 16).score).toBe(
      4,
    );
  });

  it('calculates all menstrual phases and the next expected date', async () => {
    const service = createService() as any;
    service.menstrualCycleRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 1, startDate: '2026-01-01', endDate: '2026-01-05' },
        { id: 2, startDate: '2026-01-29', endDate: '2026-02-02' },
        { id: 3, startDate: '2026-02-27', endDate: '2026-03-03' },
      ]),
    };

    const context = await service.getMenstrualManagementContext(
      42,
      '2026-03-13',
    );

    expect(context.cycle_length_days).toBe(29);
    expect(context.reference_date).toBe('2026-03-13');
    expect(context.cycle_length_source).toBe('recent_average');
    expect(context.normal_cycle_intervals_used).toEqual([28, 29]);
    expect(context.cycles).toHaveLength(3);
    expect(context.cycles[2]).toEqual({
      cycle_number: 3,
      recording_status: 'completed',
      end_date_confirmed: true,
      recorded_menstrual_period: {
        start_date: '2026-02-27',
        end_date: '2026-03-03',
      },
      menstrual_phase: {
        start_date: '2026-02-27',
        end_date: '2026-03-03',
      },
      follicular_phase: {
        start_date: '2026-03-04',
        end_date: '2026-03-11',
      },
      ovulation_phase: {
        start_date: '2026-03-12',
        end_date: '2026-03-14',
      },
      luteal_phase: {
        start_date: '2026-03-15',
        end_date: '2026-03-27',
      },
    });
    expect(context.current_phase).toEqual({
      phase: '배란기',
      start_date: '2026-03-12',
      end_date: '2026-03-14',
    });
    expect(context.current_phase_starts_today).toBe(false);
    expect(context.next_phase).toEqual({
      phase: '황체기',
      start_date: '2026-03-15',
      end_date: '2026-03-27',
    });
    expect(context.next_phase_starts_today).toBe(false);
    expect(context.next_expected_menstrual_date).toBe('2026-03-28');
    expect(context.latest_cycle_ongoing).toBe(false);
    expect(context.latest_cycle_end_date_confirmed).toBe(true);
  });

  it('treats a cycle recorded through today as ongoing, not ending today', async () => {
    const service = createService() as any;
    service.menstrualCycleRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          startDate: '2026-09-05',
          endDate: '2026-09-10',
          isEnd: true,
        },
      ]),
    };

    const context = await service.getMenstrualManagementContext(
      42,
      '2026-09-10',
    );

    expect(context.reference_date).toBe('2026-09-10');
    expect(context.current_phase).toEqual({
      phase: '월경기',
      start_date: '2026-09-05',
      end_date: '2026-09-10',
    });
    expect(context.current_phase_starts_today).toBe(false);
    expect(context.cycles[0].recording_status).toBe('ongoing');
    expect(context.cycles[0].end_date_confirmed).toBe(false);
    expect(context.cycles[0].follicular_phase).toBeNull();
    expect(context.next_phase).toBeNull();
    expect(context.next_phase_starts_today).toBe(false);
    expect(context.latest_cycle_ongoing).toBe(true);
    expect(context.latest_cycle_end_date_confirmed).toBe(false);
  });

  it('keeps an explicitly ongoing cycle unconfirmed after its last recorded day', async () => {
    const service = createService() as any;
    service.menstrualCycleRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          startDate: '2026-09-14',
          endDate: '2026-09-14',
          isEnd: false,
        },
      ]),
    };

    const context = await service.getMenstrualManagementContext(
      42,
      '2026-09-15',
    );

    expect(context.current_phase).toBeNull();
    expect(context.cycles[0].recording_status).toBe('ongoing');
    expect(context.cycles[0].end_date_confirmed).toBe(false);
    expect(context.cycles[0].follicular_phase).toBeNull();
    expect(context.next_phase).toBeNull();
    expect(context.latest_cycle_ongoing).toBe(true);
    expect(context.latest_cycle_end_date_confirmed).toBe(false);
  });

  it('marks a phase as starting today only on its exact start date', async () => {
    const service = createService() as any;
    service.menstrualCycleRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 1, startDate: '2026-09-05', endDate: '2026-09-09' },
        ]),
    };

    const context = await service.getMenstrualManagementContext(
      42,
      '2026-09-10',
    );

    expect(context.current_phase).toEqual({
      phase: '난포기',
      start_date: '2026-09-10',
      end_date: '2026-09-16',
    });
    expect(context.current_phase_starts_today).toBe(true);
    expect(context.next_phase).toEqual({
      phase: '배란기',
      start_date: '2026-09-17',
      end_date: '2026-09-19',
    });
    expect(context.next_phase_starts_today).toBe(false);
    expect(context.latest_cycle_ongoing).toBe(false);
    expect(context.latest_cycle_end_date_confirmed).toBe(true);
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
    jest
      .spyOn(service, 'formatKoreaDateTime')
      .mockReturnValue('2026-08-28T15:30:00+09:00');

    try {
      const answer = await service.callGeminiText(
        '현재 질문',
        {
          messages: [
            {
              created_at: '2026-08-27T22:30:00+09:00',
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
                  quantity_unit: 'g',
                  input_mode: 0,
                  input_mode_label: '단위 탭',
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
          recent_step_records_7_days: [{ date: '2026-08-28', steps: 8765 }],
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
      expect(requestBody.generationConfig.maxOutputTokens).toBe(900);
      expect(requestBody.contents).toEqual([
        {
          role: 'user',
          parts: [
            {
              text: '[과거 사용자 메시지 | 작성 시각: 2026-08-27T22:30:00+09:00 | 시간대: Asia/Seoul]\n이전 질문',
            },
          ],
        },
        {
          role: 'model',
          parts: [
            {
              text: '[해당 시점의 과거 assistant 답변 | 작성 시각: 2026-08-27T22:30:00+09:00 | 시간대: Asia/Seoul]\n이전 답변',
            },
          ],
        },
        { role: 'user', parts: [{ text: '현재 질문' }] },
      ]);
      expect(JSON.stringify(requestBody)).toContain('닭가슴살');
      expect(JSON.stringify(requestBody)).toContain('스쿼트');
      expect(JSON.stringify(requestBody)).toContain('64.3');
      expect(JSON.stringify(requestBody)).toContain('8765');
      expect(JSON.stringify(requestBody)).toContain('target_calories');
      expect(JSON.stringify(requestBody)).toContain('같은 음식 문화권');
      expect(JSON.stringify(requestBody)).toContain('태국 음식을 먹었다면');
      const systemInstruction = requestBody.system_instruction.parts[0]
        .text as string;
      expect(systemInstruction).not.toContain('"nickname"');
      expect(systemInstruction).not.toContain('"preferred_address"');
      expect(systemInstruction).toContain('"recorded_meal_slots":["저녁"]');
      expect(systemInstruction).toContain(
        '"current_request_datetime":"2026-08-28T15:30:00+09:00"',
      );
      expect(systemInstruction).toContain(
        '과거 메시지의 "지금", "방금", "오늘", "어제", "아까"는 해당 작성 시각을 기준으로만 해석하고',
      );
      expect(systemInstruction).toContain(
        '오늘 식사 기록 상태의 records를 먼저 확인해',
      );
      expect(systemInstruction).toContain(
        '하루 식사 기록 전체가 완료됐다는 뜻이 아니야',
      );
      expect(systemInstruction).toContain(
        '"오늘 식사 기록을 마쳤다", "오늘 식사가 끝났다", "이미 모든 식사를 했다"',
      );
      expect(systemInstruction).toContain(
        '"아침 기록이 있다", "아침과 점심을 먹었다"처럼',
      );
      expect(systemInstruction).toContain(
        '가장 최근 사용자 메시지의 질문이나 요청을 최우선으로 해석하고',
      );
      expect(systemInstruction).toContain(
        '식사 기록은 답변의 참고 근거이지 사용자의 현재 질문을 거절하는 조건이 아니야',
      );
      expect(systemInstruction).toContain(
        '이전 assistant 답변의 결론이나 거절 논리를 반복하지 말고',
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
      expect(systemInstruction).toContain('동사에 높임 표현을 섞지 마');
      expect(systemInstruction).toContain('"먹은/먹었는데/먹을/먹어봐"처럼');
      expect(systemInstruction).toContain(
        '과거 대화의 assistant 답변에 존댓말이나 주체 높임 표현이 있어도',
      );
      expect(systemInstruction).toContain(
        '과거 assistant 답변은 AI가 생성한 조언이나 추론일 뿐이며',
      );
      expect(systemInstruction).toContain(
        '사용자의 닉네임이나 이름을 답변에 언급하지 마',
      );
      expect(systemInstruction).toContain(
        '일반 호칭도 쓰지 말고 별도의 호칭 없이 바로 답해',
      );
      expect(systemInstruction).toContain('최대 5문장으로 답해');
      expect(systemInstruction).toContain(
        '"나에게 맞는 관리법 기능 전용 요청"과 별도 분량 규칙',
      );
      expect(systemInstruction).toContain('가장 적합한 5개까지만 제시');
      expect(systemInstruction).toContain('건더기 위주로 먹어');
      expect(systemInstruction).toContain('사용자 습관이나 목표로 표현하지 마');
      expect(systemInstruction).toContain('최근 3일 일별 영양 합계');
      expect(systemInstruction).toContain('최근 7일 체중 기록');
      expect(systemInstruction).toContain('최근 7일 걸음 수 기록');
      expect(systemInstruction).toContain('없는 날짜의 걸음 수는 추측하지 마');
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

  it('calculates recorded nutrition from saved weight regardless of input mode', () => {
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

    expect(service.calculateRecordedMenuNutrition(menu, 100)).toEqual({
      calories: 200,
      carbs: 25,
      protein: 10,
      fat: 5,
      sugars: 4,
      dietary_fiber: 3,
      sodium: 250,
    });
    expect(service.calculateRecordedMenuNutrition(menu, 2)).toEqual({
      calories: 4,
      carbs: 0.5,
      protein: 0.2,
      fat: 0.1,
      sugars: 0.1,
      dietary_fiber: 0.1,
      sodium: 5,
    });
  });

  it('calculates the daily snapshot from stored weight instead of raw quantity', async () => {
    const service = createService() as any;
    service.mealRepository = {
      find: jest.fn().mockResolvedValue([
        {
          mealMenus: [
            {
              quantity: 150,
              menu_input_mode: 0,
              menu: {
                name: '테스트 메뉴',
                weight: 100,
                calories: 80,
                carbs: 20,
                protein: 10,
                fat: 4,
              },
            },
          ],
        },
      ]),
    };

    const snapshot = await service.getDailyMealSnapshot(9, new Date());

    expect(snapshot.nutrition).toEqual({
      calories: 120,
      carbs: 30,
      protein: 15,
      fat: 6,
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

  it('normalizes Gemini food-image quantity estimates', () => {
    const service = createService() as any;

    const result = service.normalizeFoodImagePrediction({
      food_name: '밥',
      brand: null,
      confidence: 0.9,
      estimated_quantity: 180.04,
      quantity_unit: 'g',
      quantity_confidence: 0.67,
      position: { x: 0.5, y: 0.4 },
    });

    expect(result).toEqual({
      foodName: '밥',
      brand: null,
      confidence: 0.9,
      position: { x: 0.5, y: 0.4 },
      estimatedQuantity: 180,
      estimatedQuantityUnit: 'g',
      quantityConfidence: 0.67,
    });
  });

  it('adds estimated quantity calories without changing the DB serving fields', () => {
    const service = createService() as any;
    const menu = {
      id: 10,
      name: '(식약처_음식) 밥',
      brand: null,
      unit: 0,
      weight: 200,
      unit_quantity: '1인분',
      calories: 300,
      data_source: 0,
    };
    const score = { finalScore: 80 };

    const result = service.toFeedbackMenuResponse('밥', menu, score, {
      inputMenuName: '밥',
      menu,
      estimatedQuantity: 100,
      estimatedQuantityUnit: 'g',
      quantityConfidence: 0.7,
    });

    expect(result.weight).toBe(200);
    expect(result.calories).toBe(300);
    expect(result.estimated_quantity).toBe(100);
    expect(result.estimated_quantity_unit).toBe('g');
    expect(result.quantity_confidence).toBe(0.7);
    expect(result.estimated_calories).toBe(150);
  });

  it('sums estimated calories for the food-image feedback total', () => {
    const service = createService() as any;

    const result = service.sumFeedbackEstimatedCalories([
      {
        calories: 300,
        estimated_calories: 150,
      },
      {
        calories: 180,
        estimated_calories: 90,
      },
      {
        calories: 50,
        estimated_calories: null,
      },
    ]);

    expect(result).toBe(290);
  });

  it('replaces a processed fried-egg chat image match with the generic food menu', () => {
    const service = createService() as any;
    const result = service.normalizeRematchedFoodImageMenu(
      { food_index: 0, menu_id: 3, confidence: 0.9 },
      [
        {
          foodName: '계란 후라이',
          brand: null,
          confidence: 0.9,
          position: { x: 0.5, y: 0.5 },
          estimatedQuantity: 120,
          estimatedQuantityUnit: 'g',
          quantityConfidence: 0.6,
        },
      ],
      new Map([
        [
          1,
          {
            id: 1,
            name: '(식약처_음식) 달걀후라이',
            brand: null,
            category: null,
          },
        ],
        [
          3,
          {
            id: 3,
            name: '(식약처_가공) 계란후라이(패티용)',
            brand: null,
            category: null,
          },
        ],
      ]),
      new Map([[0, new Set([1, 3])]]),
    );

    expect(result.id).toBe(1);
    expect(result.name).toBe('(식약처_음식) 달걀후라이');
    expect(result.estimatedQuantity).toBe(120);
    expect(result.estimatedQuantityUnit).toBe('g');
    expect(result.quantityConfidence).toBe(0.6);
  });

  it('replaces a product rice chat image match with the generic plain rice menu', () => {
    const service = createService() as any;
    const result = service.normalizeRematchedFoodImageMenu(
      { food_index: 0, menu_id: 11, confidence: 0.9 },
      [
        {
          foodName: '흰밥',
          brand: null,
          confidence: 0.9,
          position: { x: 0.5, y: 0.5 },
        },
      ],
      new Map([
        [
          10,
          {
            id: 10,
            name: '(식약처_음식) 밥',
            brand: null,
            category: null,
          },
        ],
        [
          11,
          {
            id: 11,
            name: '따끈한 흰쌀밥 득템',
            brand: '득템',
            category: null,
          },
        ],
      ]),
      new Map([[0, new Set([10, 11])]]),
    );

    expect(result.id).toBe(10);
    expect(result.name).toBe('(식약처_음식) 밥');
  });

  it('allows meal record metadata for image chat history', async () => {
    const service = createService() as any;
    const imageHistory = {
      id: 21,
      response_payload: { image_url: 'https://example.com/meal.jpg' },
      meal_record: null,
    };
    service.chatHistoryRepository = {
      findOne: jest.fn().mockResolvedValue(imageHistory),
      save: jest.fn(async (value) => value),
    };

    await service.recordMealFromChat(
      { id: 9 },
      {
        chat_id: 21,
        time: 2,
        menu_ids: [3],
        menu_quantities: [1],
        menu_input_modes: [0],
      },
    );

    expect(imageHistory.meal_record).toEqual({
      time: 2,
      menu_ids: [3],
      menu_quantities: [1],
      menu_input_modes: [0],
    });
  });

  it('allows meal record metadata for parsed text meal record chat', async () => {
    const service = createService() as any;
    const textMealRecordHistory = {
      id: 22,
      response_payload: { chat_category: 'meal_record_parse' },
      meal_record: null,
    };
    service.chatHistoryRepository = {
      findOne: jest.fn().mockResolvedValue(textMealRecordHistory),
      save: jest.fn(async (value) => value),
    };

    await service.recordMealFromChat(
      { id: 9 },
      {
        chat_id: 22,
        time: 1,
        menu_ids: [3],
        menu_quantities: [120],
        menu_input_modes: [1],
      },
    );

    expect(textMealRecordHistory.meal_record).toEqual({
      time: 1,
      menu_ids: [3],
      menu_quantities: [120],
      menu_input_modes: [1],
    });
  });

  it('rejects meal record metadata for ordinary text chat history', async () => {
    const service = createService() as any;
    service.chatHistoryRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 22,
        response_payload: { chat_category: 'general' },
        meal_record: null,
      }),
      save: jest.fn(),
    };

    await expect(
      service.recordMealFromChat(
        { id: 9 },
        {
          chat_id: 22,
          time: 2,
          menu_ids: [3],
          menu_quantities: [1],
          menu_input_modes: [0],
        },
      ),
    ).rejects.toThrow(
      'meal record mode is available only for image or meal record chat',
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
      recent_step_records_7_days: [],
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
    expect(lightweightContext.recent_step_records_7_days).toEqual([]);
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

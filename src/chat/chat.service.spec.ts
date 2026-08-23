import { ChatService } from './chat.service';
import { ChatHistoryEntity } from './entity/chat-history.entity';

describe('ChatService conversation memory', () => {
  const createService = (): ChatService =>
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
    );

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

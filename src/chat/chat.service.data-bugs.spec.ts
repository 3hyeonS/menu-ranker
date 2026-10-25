import { IsNull } from 'typeorm';
import { ChatService } from './chat.service';

describe('ChatService data bug fixes', () => {
  it('looks up the open conversation session with IS NULL', async () => {
    const service = Object.create(ChatService.prototype) as any;
    const stop = new Error('stop after session lookup');
    service.reconcileConversationSessions = jest
      .fn()
      .mockResolvedValue(undefined);
    service.conversationSessionRepository = {
      findOne: jest.fn().mockRejectedValue(stop),
    };

    await expect(service.getRecentChatContext(3)).rejects.toBe(stop);

    expect(service.conversationSessionRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 3, closedAt: IsNull() },
      }),
    );
  });

  it('recognizes a gram unit written right after the number', () => {
    const service = Object.create(ChatService.prototype) as any;

    expect(service.asNutritionUnit('100g')).toBe(0);
    expect(service.asNutritionUnit(null, '1회 제공량 30 g')).toBe(0);
    expect(service.asNutritionUnit('500ml')).toBe(1);
    expect(() => service.asNutritionUnit('2kg')).toThrow();
  });
});

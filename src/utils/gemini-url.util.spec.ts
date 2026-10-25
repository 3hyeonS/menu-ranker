import { buildGeminiGenerateContentUrl } from './gemini-url.util';

describe('buildGeminiGenerateContentUrl', () => {
  it('uses the Google endpoint for each model when no override is set', () => {
    expect(buildGeminiGenerateContentUrl('gemini-2.5-flash')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(buildGeminiGenerateContentUrl('gemini-2.5-flash', '  ')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
  });

  it('substitutes {model} in the override for each attempt', () => {
    const override =
      'https://proxy.example.com/v1beta/models/{model}:generateContent';

    expect(buildGeminiGenerateContentUrl('model-a', override)).toBe(
      'https://proxy.example.com/v1beta/models/model-a:generateContent',
    );
    expect(buildGeminiGenerateContentUrl('model-b', override)).toBe(
      'https://proxy.example.com/v1beta/models/model-b:generateContent',
    );
  });

  it('keeps any other override unchanged as before', () => {
    expect(
      buildGeminiGenerateContentUrl('model-a', 'https://proxy.internal/gemini'),
    ).toBe('https://proxy.internal/gemini');
  });

  it('replaces the model in a full generateContent URL so fallback models are really called', () => {
    const override =
      'https://proxy.example.com/v1beta/models/pinned-model:generateContent';

    expect(buildGeminiGenerateContentUrl('fallback-model', override)).toBe(
      'https://proxy.example.com/v1beta/models/fallback-model:generateContent',
    );
  });
});

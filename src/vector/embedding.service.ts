import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

type GeminiEmbeddingError = {
  response?: {
    status?: number;
    data?: {
      error?: {
        code?: number;
        status?: string;
        message?: string;
      };
    };
  };
  code?: string;
  message?: string;
};

@Injectable()
export class EmbeddingService {
  private readonly defaultEmbeddingDimension = 768;

  constructor(private readonly httpService: HttpService) {}

  async embedText(text: string): Promise<number[]> {
    const normalizedText = text?.trim();

    if (!normalizedText) {
      return [];
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001';
    const dimension = Number(
      process.env.VECTOR_EMBEDDING_DIMENSION ?? this.defaultEmbeddingDimension,
    );
    const baseUrl =
      process.env.GEMINI_EMBEDDING_BASE_URL ??
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;

    if (!apiKey) {
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${baseUrl}?key=${apiKey}`,
          {
            model: `models/${model}`,
            content: {
              parts: [{ text: normalizedText }],
            },
            output_dimensionality: dimension,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 20000,
          },
        ),
      );

      const values = response.data?.embedding?.values;

      if (!Array.isArray(values)) {
        throw new Error('Gemini returned empty embedding');
      }

      const embedding = values.map((value) => Number(value));

      if (
        embedding.length !== dimension ||
        embedding.some((value) => !Number.isFinite(value))
      ) {
        throw new Error(
          `Gemini embedding dimension mismatch: expected ${dimension}, got ${embedding.length}`,
        );
      }

      return embedding;
    } catch (error) {
      this.logEmbeddingError(error);
      throw new ServiceUnavailableException(
        'Gemini embedding pipeline is unavailable',
      );
    }
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      embeddings.push(await this.embedText(text));
    }

    return embeddings;
  }

  private logEmbeddingError(error: unknown): void {
    const geminiError = error as GeminiEmbeddingError;

    console.error('[EMBEDDING] GEMINI ERROR', {
      httpStatus: geminiError.response?.status ?? null,
      errorCode: geminiError.response?.data?.error?.code ?? null,
      errorStatus: geminiError.response?.data?.error?.status ?? null,
      errorMessage:
        geminiError.response?.data?.error?.message ??
        geminiError.message ??
        null,
      networkCode: geminiError.code ?? null,
    });
  }
}

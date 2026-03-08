import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ResponseDto } from 'src/response-dto';

type Primary = string | number | boolean | null;
export interface PrimitiveApiResponseOption {
  status?: number;
  description?: string;
  isArray?: boolean;
  type: 'string' | 'boolean' | 'number' | 'null';
  example?: Primary;
  message?: string;
}

export const PrimitiveApiResponse = (option: PrimitiveApiResponseOption) => {
  const isArrray = option.isArray || false;

  if (isArrray) {
    return applyDecorators(
      ApiExtraModels(ResponseDto),
      ApiResponse({
        status: option.status || 777,
        description: option.description || '설명 없음',
        schema: {
          allOf: [
            { $ref: getSchemaPath(ResponseDto) },
            {
              properties: {
                message: {
                  type: 'string',
                  example: option.message,
                },
                statusCode: {
                  type: 'number',
                  example: option.status,
                },
                data: {
                  type: 'array',
                  items: {
                    type: option.type,
                    example: option.example,
                  },
                },
              },
            },
          ],
        },
      }),
    );
  } else {
    return applyDecorators(
      ApiExtraModels(ResponseDto),
      ApiResponse({
        status: option.status || 777,
        description: option.description || '설명 없음',
        schema: {
          allOf: [
            { $ref: getSchemaPath(ResponseDto) },
            {
              properties: {
                message: {
                  type: 'string',
                  example: option.message,
                },
                statusCode: {
                  type: 'number',
                  example: option.status,
                },
                data: {
                  type: option.type,
                  example: option.example,
                },
              },
            },
          ],
        },
      }),
    );
  }
};

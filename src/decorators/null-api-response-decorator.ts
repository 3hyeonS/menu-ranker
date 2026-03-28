import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ResponseDto } from '../response-dto';

export interface NullApiResponseOption {
  status?: number;
  description?: string;
  message?: string;
}

export const NullApiResponse = (option: NullApiResponseOption) => {
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
                nullable: true,
                example: null,
              },
            },
          },
        ],
      },
    }),
  );
};

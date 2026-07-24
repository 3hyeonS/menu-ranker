import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class DeleteFolderRequestDto {
  @ApiProperty({
    type: Number,
    description: '삭제할 폴더 id',
    example: 1,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  folder_id: number;
}

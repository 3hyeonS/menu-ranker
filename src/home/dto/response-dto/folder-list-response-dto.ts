import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export class FolderListItemResponseDto {
  @ApiProperty({
    type: Number,
    description: '폴더 id',
    example: 1,
  })
  folder_id: number;

  @ApiProperty({
    type: String,
    description: '폴더명',
    example: '자주 먹는 아침',
  })
  folder_name: string;

  @ApiProperty({
    type: [String],
    description: '폴더에 포함된 메뉴명 목록',
    example: ['밥', '삶은 달걀'],
  })
  menu_names: string[];
}

export class FolderListResponseDto {
  @ValidateNested({ each: true })
  @ApiProperty({
    type: [FolderListItemResponseDto],
    description: '폴더 리스트',
  })
  @Type(() => FolderListItemResponseDto)
  folder_list: FolderListItemResponseDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '다음 페이지 조회 cursor. 더 없으면 null',
    example: 10,
  })
  next_cursor: number | null;

  constructor(
    folderList: FolderListItemResponseDto[],
    nextCursor: number | null,
  ) {
    this.folder_list = folderList;
    this.next_cursor = nextCursor;
  }
}

import { ApiProperty } from '@nestjs/swagger';

export class FolderIdResponseDto {
  @ApiProperty({
    type: Number,
    description: '폴더 id',
    example: 1,
  })
  folder_id: number;

  constructor(folderId: number) {
    this.folder_id = folderId;
  }
}

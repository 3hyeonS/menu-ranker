import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { MenuVectorService } from './menu-vector.service';
import { vectorDataSourceProvider } from './vector-db.provider';

@Module({
  imports: [HttpModule],
  providers: [EmbeddingService, MenuVectorService, vectorDataSourceProvider],
  exports: [EmbeddingService, MenuVectorService],
})
export class VectorModule {}

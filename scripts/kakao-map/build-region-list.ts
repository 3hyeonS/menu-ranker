// 행정동 경계 GeoJSON으로 수도권(경기·인천) 수집 지역 목록 TSV를 만든다. 이슈 #47.
// 입력: vuski/admdongkor `HangJeongDong_ver<날짜>.geojson`(통계청 행정동 경계). 네트워크를 쓰지 않는다.
// 출력(표준 출력): `폴더<TAB>사각형;사각형…<TAB>주소 필터`. 실행 방법은 docs/kakao-map-menu-crawler.md.
import { readFileSync } from 'fs';
import { basename } from 'path';
import { arg } from '../crawl-common/crawl-cli';
import {
  buildRegionCovers,
  DEFAULT_COVER_OPTIONS,
  formatRegionLine,
  GeoFeature,
} from './region-cover';

function main(): void {
  const path = arg('geojson');
  if (!path)
    throw new Error('--geojson=<행정동 경계 GeoJSON 경로>가 필요합니다');
  const json = JSON.parse(readFileSync(path, 'utf8')) as {
    features?: GeoFeature[];
  };
  if (!Array.isArray(json.features))
    throw new Error(`GeoJSON FeatureCollection이 아닙니다: ${path}`);
  const regions = buildRegionCovers(json.features);
  const { cellDeg, dilateCells, coarseCells } = DEFAULT_COVER_OPTIONS;
  const rectCount = regions.reduce((sum, r) => sum + r.rects.length, 0);
  console.log(
    `# 폴더\t검색 사각형(;)\t주소 필터 — ${basename(path)}, 칸 ${cellDeg}도·여유 ${dilateCells}칸·사각형 단위 ${cellDeg * coarseCells}도, 지역 ${regions.length}개·사각형 ${rectCount}개`,
  );
  for (const region of regions) console.log(formatRegionLine(region));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

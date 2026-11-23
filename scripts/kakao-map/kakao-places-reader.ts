// 여러 places.jsonl(음식점 FD6·카페 CE7, 구별 폴더)을 읽어 장소 목록 하나로 합친다.
import { readJsonLines } from '../crawl-common/crawl-files';
import { KakaoPlace, parseKakaoPlace } from './kakao-brand-matcher';

export interface ReadPlacesResult {
  places: KakaoPlace[];
  /** id·name이 없는 등 형식이 맞지 않는 줄 수(JSON이 깨진 줄은 readJsonLines가 건너뛴다). */
  invalidLineCount: number;
  /** 앞 파일에서 이미 읽은 장소 id 수. */
  duplicateCount: number;
}

/** 같은 장소 id는 처음 읽은 것만 쓴다. 구 경계에 걸친 장소는 두 구 파일에 모두 있을 수 있다. */
export function readPlaces(paths: readonly string[]): ReadPlacesResult {
  const placeById = new Map<string, KakaoPlace>();
  let invalidLineCount = 0;
  let duplicateCount = 0;

  for (const path of paths) {
    for (const row of readJsonLines<unknown>(path)) {
      const place = parseKakaoPlace(row);
      if (!place) {
        invalidLineCount += 1;
        continue;
      }
      if (placeById.has(place.id)) {
        duplicateCount += 1;
        continue;
      }
      placeById.set(place.id, place);
    }
  }

  return { places: [...placeById.values()], invalidLineCount, duplicateCount };
}

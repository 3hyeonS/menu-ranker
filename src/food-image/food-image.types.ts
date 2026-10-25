// 음식 사진 매칭 후보 메뉴. FoodImageMenuCatalog가 공용 + 내 개인 메뉴에서 만든다.
export type FoodImageMenuCandidate = {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  weight: number | null;
  unit: number | null;
  ownerUserId?: number | null;
  frequentRank?: number;
};

// Gemini 1차 인식 결과 중 매칭에 필요한 값. 위치 등 호출부 전용 값은 호출부 타입에 둔다.
export type FoodImageMatchPrediction = {
  foodName: string;
  productName?: string | null;
  brand: string | null;
  confidence: number | null;
  estimatedQuantity: number | null;
  quantityConfidence: number | null;
};

export type FoodImageCandidateGroup = {
  foodIndex: number;
  foodName: string;
  candidates: FoodImageMenuCandidate[];
  preferredCandidateId?: number;
};

// 음식 하나(foodIndex)에 고른 메뉴. 같은 메뉴는 한 번만 나온다.
export type FoodImageMenuMatch = FoodImageMenuCandidate & {
  foodIndex: number;
  confidence: number | null;
  estimatedQuantity: number | null;
  estimatedQuantityUnit: 'g' | 'ml';
  quantityConfidence: number | null;
};

export type FoodImageTimingLogger = {
  mark(name: string, data?: Record<string, unknown>): void;
};

// 개인 식당(브랜드 미연결 카카오 지점)을 기존 /restaurant/detail 계약으로 내보낼 때 쓰는 가상 ID와 표시 기준(#41 결정).
// 브랜드 restaurant.id·restaurant_menu.id는 이 범위에 닿지 않는다(브랜드 수십 개, 공식 메뉴 수천 개).

/** 개인 식당 가상 restaurant_id = 오프셋 + restaurant_branch.id */
export const INDEPENDENT_RESTAURANT_ID_OFFSET = 100_000_000;
/** 개인 식당 추정 메뉴 가상 menu_id = 오프셋 + restaurant_branch_menu.id. 식사 기록(meal_menu)과는 잇지 않는다. */
export const BRANCH_MENU_ID_OFFSET = 100_000_000;
/** 이 값 미만 confidence의 추정값은 저장하되 앱에 내보내지 않는다(#41 결정 5, 프로토콜 보류 기준). */
export const MIN_DISPLAY_ESTIMATE_CONFIDENCE = 0.6;

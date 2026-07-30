export const SUGAR_ALTERNATIVE_KEYWORDS = [
  '당알코올',
  '당 알코올',
  '대체당',
  '감미료',
  '에리스리톨',
  'erythritol',
  '자일리톨',
  'xylitol',
  '소르비톨',
  'sorbitol',
  '말티톨',
  'maltitol',
  '락티톨',
  'lactitol',
  '만니톨',
  'mannitol',
  '이소말트',
  'isomalt',
  '팔라티니트',
  'palatinit',
  '알룰로오스',
  'allulose',
  '스테비아',
  'stevia',
  '스테비올배당체',
  '나한과',
  'monk fruit',
  '모그로사이드',
  'mogroside',
  '수크랄로스',
  'sucralose',
  '아스파탐',
  'aspartame',
  '아세설팜칼륨',
  '아세설팜k',
  'acesulfame',
  'acesulfame potassium',
  '타가토스',
  'tagatose',
  '네오탐',
  'neotame',
];

export const SUGAR_ALTERNATIVE_PROMPT_SECTION = `
대체당/당알코올 인식 규칙:
- 아래 성분이 영양성분표나 원재료명에 보이면 sugar_alchol 필드에 당알코올/대체당 값으로 반영해.
- 성분명에 접두사/접미사가 붙어도 핵심 단어가 포함되면 같은 성분으로 봐. 예: D-소르비톨, 효소처리스테비아, 액상알룰로오스.
- sugar_alchol은 g 단위 필드야. mg로 표기된 경우 g로 환산해서 숫자만 반환해. 예: 500mg -> 0.5.
- 0g으로 표기되어 있으면 null이 아니라 0으로 반환해.
- 대체당 성분명만 보이고 함량 숫자가 보이지 않으면 sugar_alchol은 null로 둬.
- 대상 성분: 에리스리톨, 자일리톨, 소르비톨, 말티톨, 락티톨, 만니톨, 이소말트, 팔라티니트, 알룰로오스, 스테비아, 스테비올배당체, 나한과 추출물, 모그로사이드, 수크랄로스, 아스파탐, 아세설팜칼륨, 아세설팜K, 타가토스, 네오탐.
`.trim();

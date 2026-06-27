export const stripPublicMenuSourcePrefix = (menuName: string): string =>
  menuName.replace(/^\s*\((?:식약처_음식|식약처_가공)\)\s*/g, '').trim();

const MENU_SEARCH_ALIAS_GROUPS: Array<{
  canonical: string;
  aliases: string[];
}> = [
  { canonical: '달걀', aliases: ['계란', '달걀'] },
  { canonical: '프라이', aliases: ['후라이', '프라이'] },
  {
    canonical: '삶은달걀',
    aliases: ['삶은계란', '삶은달걀', '완숙란', '완숙계란'],
  },
  {
    canonical: '반숙달걀',
    aliases: ['반숙계란', '반숙달걀', '반숙란', '감동란'],
  },
  {
    canonical: '구운달걀',
    aliases: [
      '구운계란',
      '맥반석계란',
      '훈제계란',
      '훈제달걀',
      '구운달걀',
    ],
  },
  { canonical: '밥', aliases: ['쌀밥', '흰밥', '백미밥', '이밥', '밥'] },
  {
    canonical: '현미밥',
    aliases: ['현미밥', '100%현미밥', '발아현미밥'],
  },
  {
    canonical: '잡곡밥',
    aliases: ['잡곡밥', '현미잡곡밥', '오곡밥', '흑미밥'],
  },
  {
    canonical: '곤약밥',
    aliases: ['곤약밥', '곤약쌀밥', '곤약즉석밥', '컬리플라워라이스'],
  },
  {
    canonical: '오트밀',
    aliases: [
      '오트밀',
      '귀리밥',
      '오트밥',
      '귀리',
      '오트',
      '퀵오트',
      '롤드오트',
      '오나오',
      '오버나이트오트밀',
    ],
  },
  {
    canonical: '닭가슴살',
    aliases: [
      '닭가슴살',
      '닭찌',
      '닭찌찌',
      '닭가슴',
      '생닭가슴살',
      '훈제닭가슴살',
    ],
  },
  { canonical: '닭안심', aliases: ['닭안심', '닭안심살', '안심살'] },
  {
    canonical: '닭다리살',
    aliases: ['닭다리살', '닭정육', '정육', '순살닭다리살'],
  },
  {
    canonical: '치킨',
    aliases: [
      '치킨',
      '프라이드치킨',
      '양념치킨',
      '양념닭',
      '순살치킨',
      '순살닭',
      '통닭',
    ],
  },
  { canonical: '닭볶음탕', aliases: ['닭볶음탕', '닭도리탕'] },
  { canonical: '소고기', aliases: ['소고기', '쇠고기'] },
  { canonical: '소불고기', aliases: ['불고기', '소불고기'] },
  { canonical: '소안심', aliases: ['소안심', '안심', '히레'] },
  { canonical: '소등심', aliases: ['소등심', '등심', '로스', '채끝'] },
  { canonical: '차돌박이', aliases: ['차돌박이', '차돌', '우삼겹'] },
  { canonical: '갈비탕', aliases: ['갈비탕', '소갈비탕', '왕갈비탕'] },
  { canonical: '육회', aliases: ['생소고기', '육회'] },
  { canonical: '돼지고기', aliases: ['돼지고기', '돈육'] },
  {
    canonical: '삼겹살',
    aliases: ['삼겹살', '생삼겹', '오겹살', '대패삼겹살', '삼겹'],
  },
  { canonical: '돼지목살', aliases: ['돼지목살', '목살', '목심'] },
  {
    canonical: '돼지앞다리살',
    aliases: ['돼지앞다리살', '앞다리살', '전지'],
  },
  {
    canonical: '돼지뒷다리살',
    aliases: ['돼지뒷다리살', '뒷다리살', '후지'],
  },
  {
    canonical: '제육볶음',
    aliases: ['제육볶음', '돼지고기볶음', '두루치기', '돼지불고기'],
  },
  { canonical: '수육', aliases: ['보쌈', '수육', '돼지수육'] },
  { canonical: '족발', aliases: ['족발', '돼지족발'] },
  { canonical: '돈가스', aliases: ['돈가스', '돈까스', '카츠'] },
  {
    canonical: '안심돈가스',
    aliases: ['안심돈가스', '안심돈까스', '안심카츠'],
  },
  {
    canonical: '등심돈가스',
    aliases: ['등심돈가스', '등심돈까스', '등심카츠'],
  },
  { canonical: '연어', aliases: ['연어', '생연어', '연어회'] },
  { canonical: '고등어', aliases: ['고등어', '고등어구이', '생고등어'] },
  { canonical: '꽁치', aliases: ['꽁치', '꽁치구이', '꽁치캔'] },
  { canonical: '갈치', aliases: ['갈치', '갈치구이', '갈치조림'] },
  {
    canonical: '오징어',
    aliases: ['오징어', '생오징어', '물오징어', '오징어숙회'],
  },
  { canonical: '문어', aliases: ['문어', '문어숙회', '자숙문어'] },
  {
    canonical: '참치캔',
    aliases: ['참치캔', '캔참치', '마일드참치', '살코기참치', '고추참치'],
  },
  { canonical: '참치회', aliases: ['참치회', '다랑어', '참치', '참다랑어'] },
  { canonical: '생태', aliases: ['생태', '생물명태'] },
  { canonical: '명태', aliases: ['명태', '동태', '냉동명태'] },
  {
    canonical: '황태',
    aliases: ['북어', '황태', '건명태', '말린명태', '황태채', '북어채'],
  },
  { canonical: '두부', aliases: ['두부', '판두부', '부침두부', '찌개두부'] },
  { canonical: '순두부', aliases: ['순두부', '연두부'] },
  { canonical: '콩', aliases: ['콩', '대두', '검은콩', '흑태', '서리태'] },
  { canonical: '두유', aliases: ['두유', '콩물', '콩우유', '베지밀'] },
  { canonical: '우유', aliases: ['우유', '흰우유', '일반우유', '전지유'] },
  { canonical: '저지방우유', aliases: ['저지방우유', '저지방밀크'] },
  { canonical: '무지방우유', aliases: ['무지방우유', '스킴밀크'] },
  {
    canonical: '그릭요거트',
    aliases: ['그릭요거트', '그릭요구르트', '수제요거트'],
  },
  {
    canonical: '요거트',
    aliases: ['요거트', '요구르트', '플레인요거트', '떠먹는요구르트'],
  },
  {
    canonical: '치즈',
    aliases: ['치즈', '체다치즈', '슬라이스치즈', '사각치즈'],
  },
  {
    canonical: '모짜렐라치즈',
    aliases: ['모짜렐라치즈', '모짜렐라', '피자치즈', '스트링치즈'],
  },
  { canonical: '채소', aliases: ['채소', '야채', '샐러드채소'] },
  { canonical: '브로콜리', aliases: ['브로콜리', '브로컬리'] },
  { canonical: '파프리카', aliases: ['파프리카', '피망'] },
  { canonical: '애호박', aliases: ['애호박', '호박'] },
  { canonical: '배추', aliases: ['배추', '알배추', '통배추'] },
  { canonical: '양파', aliases: ['양파', '생양파', '적양파'] },
  { canonical: '대파', aliases: ['대파', '파', '쪽파', '실파'] },
  { canonical: '마늘', aliases: ['마늘', '생마늘', '다진마늘', '통마늘'] },
  { canonical: '토마토', aliases: ['토마토', '찰토마토', '일반토마토'] },
  {
    canonical: '방울토마토',
    aliases: ['방울토마토', '방토', '대추방울토마토'],
  },
  {
    canonical: '고구마',
    aliases: [
      '고구마',
      '군고구마',
      '찐고구마',
      '생고구마',
      '밤고구마',
      '호박고구마',
    ],
  },
  {
    canonical: '견과류',
    aliases: ['견과류', '믹스넛', '하루견과', '아몬드', '호두'],
  },
  {
    canonical: '아메리카노',
    aliases: [
      '아메리카노',
      '아아',
      '뜨아',
      '아이스아메리카노',
      '콜드브루',
      '드립커피',
      '블랙커피',
    ],
  },
  {
    canonical: '카페라떼',
    aliases: ['카페라떼', '카페라테', '라떼', '라테', '아이스라떼'],
  },
  { canonical: '녹차', aliases: ['녹차', '그린티', '말차'] },
  { canonical: '홍차', aliases: ['홍차', '블랙티', '밀크티'] },
  {
    canonical: '탄산음료',
    aliases: [
      '콜라',
      '사이다',
      '웰치스',
      '펩시',
      '스프라이트',
      '탄산음료',
    ],
  },
  {
    canonical: '제로탄산',
    aliases: [
      '제로콜라',
      '제로사이다',
      '콜라제로',
      '사이다제로',
      '제콜',
      '펩시제로',
      '코카제로',
      '나랑드사이다',
      '제로탄산',
    ],
  },
  {
    canonical: '탄산수',
    aliases: ['탄산수', '스파클링워터', '씨그램', '트레비'],
  },
  {
    canonical: '단백질쉐이크',
    aliases: [
      '단백질쉐이크',
      '프로틴쉐이크',
      '단백질파우더',
      '프로틴파우더',
      '식사대용쉐이크',
    ],
  },
  {
    canonical: '단백질음료',
    aliases: [
      '단백질음료',
      '프로틴드링크',
      '프로틴음료',
      '셀렉스',
      '더단백',
      '하이뮨',
      '랩노쉬',
    ],
  },
  {
    canonical: '크루아상',
    aliases: ['크루아상', '크로와상', '크로와쌍', '크로플'],
  },
  { canonical: '식빵', aliases: ['식빵', '우유식빵', '화이트식빵'] },
  {
    canonical: '통밀빵',
    aliases: ['통밀식빵', '호밀식빵', '호밀빵', '통밀빵'],
  },
  { canonical: '짜장면', aliases: ['짜장면', '자장면'] },
  { canonical: '짬뽕', aliases: ['짬뽕', '해물짬뽕', '고기짬뽕'] },
  {
    canonical: '냉면',
    aliases: ['냉면', '평양냉면', '함흥냉면', '물냉면', '비빔냉면', '냉면면'],
  },
  { canonical: '국수', aliases: ['국수', '소면', '중면', '잔치국수'] },
  {
    canonical: '비빔국수',
    aliases: ['비빔국수', '비빔면', '팔도비빔면'],
  },
  {
    canonical: '파스타',
    aliases: ['파스타', '스파게티', '파스타면', '펜네', '푸실리'],
  },
  { canonical: '단백질', aliases: ['단백질', '프로틴'] },
  { canonical: '소시지', aliases: ['소세지', '소시지'] },
  { canonical: '주스', aliases: ['쥬스', '주스'] },
];

export const normalizeMenuSearchName = (menuName: string): string =>
  stripPublicMenuSourcePrefix(menuName ?? '')
    .toLowerCase()
    .replace(/[^\w가-힣]/g, '')
    .trim();

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MENU_SEARCH_ALIAS_MAP = new Map<string, string>();

MENU_SEARCH_ALIAS_GROUPS.forEach(({ canonical, aliases }) => {
  const normalizedCanonical = normalizeMenuSearchName(canonical);

  aliases.forEach((alias) => {
    const normalizedAlias = normalizeMenuSearchName(alias);

    if (normalizedAlias) {
      MENU_SEARCH_ALIAS_MAP.set(normalizedAlias, normalizedCanonical);
    }
  });
});

const MENU_SEARCH_ALIAS_PATTERN = new RegExp(
  Array.from(MENU_SEARCH_ALIAS_MAP.keys())
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|'),
  'g',
);

export const canonicalizeMenuSearchName = (menuName: string): string => {
  const normalized = normalizeMenuSearchName(menuName);

  if (!normalized || MENU_SEARCH_ALIAS_MAP.size === 0) {
    return normalized;
  }

  return normalized.replace(
    MENU_SEARCH_ALIAS_PATTERN,
    (matched) => MENU_SEARCH_ALIAS_MAP.get(matched) ?? matched,
  );
};

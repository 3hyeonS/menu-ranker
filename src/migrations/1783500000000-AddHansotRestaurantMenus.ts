import { createHash } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

const HANSOT_MENUS: Array<[string, string, number]> = [
  ['왕갈비맛 함박스테이크', '10월 신메뉴', 1085.7],
  ['치폴레 함박스테이크', '10월 신메뉴', 1115.7],
  ['치즈 한우 함박스테이크', '10월 신메뉴', 973.7],
  ['더블 왕갈비맛 함박스테이크 덮밥', '10월 신메뉴', 1469.4],
  ['더블 치폴레 함박스테이크 덮밥', '10월 신메뉴', 1529.4],
  ['어니언링', '10월 신메뉴', 217.8],
  ['스페셜 해바라기 도시락', '스페셜', 1302.8],
  ['스페셜 숯불직화 진달래 도시락', '스페셜', 923.5],
  ['스페셜 송정식 떡갈비 도시락', '스페셜', 1134],
  ['매화 연어', '프리미엄', 1024],
  ['매화 고등어', '프리미엄', 1071],
  ['해바라기', '프리미엄', 1037],
  ['진달래', '프리미엄', 907],
  ['카츠카츠 고기고기', '고기고기', 1017.9],
  ['돈까스도련님 고기고기', '고기고기', 999],
  ['돈치 고기고기', '고기고기', 919],
  ['새치 고기고기', '고기고기', 990],
  ['동백', '모둠', 838],
  ['돈치스팸', '모둠', 771],
  ['칠리 찹쌀탕수육도련님', '모둠', 822],
  ['돈까스도련님', '모둠', 834],
  ['제육 돈까스도련님', '모둠', 843],
  ['송정식 떡갈비', '모둠', 975],
  ['치킨제육', '모둠', 879],
  ['더블 돈까스도련님', '더블', 1266.8],
  ['더블 칠리 찹쌀탕수육도련님', '더블', 1157.4],
  ['메가치킨마요', '마요', 1127],
  ['빅치킨마요', '마요', 817],
  ['치킨마요', '마요', 647],
  ['스팸마요', '마요', 563],
  ['참치마요', '마요', 611],
  ['김치볶음밥&돼지불백', '볶음밥', 747.6],
  ['스팸 김치볶음밥', '볶음밥', 541],
  ['김치볶음밥', '볶음밥', 523],
  ['부대찌개', '찌개', 509],
  ['묵은지 김치찌개', '찌개', 480],
  ['왕갈비맛 함박스테이크 덮밥', '덮밥', 904.3],
  ['치폴레 함박스테이크 덮밥', '덮밥', 934.3],
  ['왕카레치킨 덮밥', '덮밥', 890.3],
  ['돼지불백 덮밥', '덮밥', 679.1],
  ['왕김치돈까스 덮밥', '덮밥', 833],
  ['제많덮(제육 많이 덮밥)', '덮밥', 947.7],
  ['빅 제많덮(빅 제육 많이 덮밥)', '덮밥', 1202.3],
  ['왕카레돈까스 덮밥', '덮밥', 938],
  ['숯불직화구이 덮밥', '덮밥', 635],
  ['김치 제육 덮밥', '덮밥', 605.4],
  ['오리지널 치즈 닭갈비덮밥', '덮밥', 681],
  ['열무 감초고추장 비빔밥', '덮밥', 486],
  ['김치 참치 덮밥', '덮밥', 504],
  ['핫 치즈 닭갈비덮밥', '덮밥', 681],
  ['돈까스 카레', '덮밥', 703],
  ['돈까스 덮밥', '덮밥', 559],
  ['소불고기 감초고추장 비빔밥', '비빔밥', 662],
  ['시골제육 두부강된장 비빔밥', '비빔밥', 625],
  ['참치야채 감초고추장 비빔밥', '비빔밥', 606],
  ['빅치킨마요 부대찌개 정식', '정식', 1009],
  ['치킨마요 부대찌개 정식', '정식', 839],
  ['단품 부대찌개', '단품/실속반찬', 192],
  ['단품 묵은지 김치찌개', '단품/실속반찬', 194],
  ['단품 카레', '단품/실속반찬', 498.5],
  ['반찬 돈까스도련님', '단품/실속반찬', 321],
  ['반찬 치킨', '단품/실속반찬', 326],
  ['반찬 제육볶음', '단품/실속반찬', 186],
  ['반찬 돈까스', '단품/실속반찬', 214],
  ['반찬 토네이도 소세지', '단품/실속반찬', 353],
  ['반찬 고기고기', '단품/실속반찬', 362],
  ['반찬 고등어 데리야끼', '단품/실속반찬', 192.7],
  ['집반찬 무말랭이', '미니반찬&집반찬', 215],
  ['집반찬 볶음김치', '미니반찬&집반찬', 81],
  ['집반찬 맛김치', '미니반찬&집반찬', 45],
  ['미니반찬 볶음김치', '미니반찬&집반찬', 13.5],
  ['미니반찬 김치', '미니반찬&집반찬', 5.4],
  ['한솥 조미김', '미니반찬&집반찬', 6],
  ['12곡밥', '밥', 350],
  ['발아현미밥', '밥', 320],
  ['한솥밥', '밥', 315.1],
  ['한솥 허니버터시즈닝', '소스', 23],
  ['한솥 치즈버터시즈닝', '소스', 27],
  ['생와사비', '소스', 8],
  ['한솥 케이준소스', '소스', 89],
  ['한솥 양념치킨소스', '소스', 77],
  ['한솥 미니탕수육소스', '소스', 60],
  ['한솥 타르타르소스', '소스', 55],
  ['한솥 라유소스', '소스', 26],
  ['한솥 돈부리소스', '소스', 67],
  ['한솥 덮밥용 소이소스', '소스', 40],
  ['한솥 마요드레싱 소스', '소스', 65],
  ['일회용 참기름 소스', '소스', 35],
  ['토마토 케찹 소스', '소스', 12],
  ['한솥 양식소스', '소스', 25],
  ['한솥 칠리소스', '소스', 80],
  ['한솥 치킨마요소스', '소스', 125],
  ['한솥 빅치킨마요소스', '소스', 140],
  ['한솥 두부강된장소스', '소스', 85],
  ['한솥 감초볶음고추장소스', '소스', 70],
  ['해시 포테이토 스틱', '스낵', 175.23],
  ['치즈버터 해시 포테이토 스틱', '스낵', 190.14],
  ['허니버터 해시 포테이토 스틱', '스낵', 180],
  ['뉴 감자고로케', '스낵', 219],
  ['미니 찹쌀핫도그', '스낵', 273.4],
  ['미니 찹쌀탕수육', '스낵', 238],
  ['케이준후라이', '스낵', 195],
  ['김피탕', '스낵', 658.3],
  ['크림 닭강정(소)', '치킨', 645.8],
  ['크림 닭강정(중)', '치킨', 1608.4],
  ['한솥 닭강정(소)', '치킨', 475],
  ['한솥 닭강정(중)', '치킨', 1424],
  ['후라이드 순살(소)_양념치킨소스', '치킨', 406],
  ['후라이드 순살(소)_케이준소스', '치킨', 420],
  ['후라이드 순살(중)', '치킨', 827],
  ['제주녹차 미니꿀호떡', '디저트', 372.4],
];

function sourceKey(name: string): string {
  return createHash('sha256')
    .update(`hansot-official-menu-v1:${name}`)
    .digest('hex');
}

export class AddHansotRestaurantMenus1783500000000 implements MigrationInterface {
  name = 'AddHansotRestaurantMenus1783500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `restaurant_menu` MODIFY `weight` decimal(12,3) NULL',
    );
    await queryRunner.query(
      `
        INSERT INTO \`restaurant\` (\`name\`, \`normalized_name\`, \`category\`)
        SELECT '한솥', '한솥', '도시락'
        WHERE NOT EXISTS (
          SELECT 1 FROM \`restaurant\` WHERE \`name\` = '한솥'
        )
      `,
    );

    const restaurants: Array<{ id: number }> = await queryRunner.query(
      'SELECT `id` FROM `restaurant` WHERE `name` = ? LIMIT 1',
      ['한솥'],
    );
    const restaurantId = restaurants[0]?.id;
    if (!restaurantId) {
      throw new Error('한솥 식당을 생성하거나 찾지 못했습니다.');
    }

    for (const [name, menuCategory, calories] of HANSOT_MENUS) {
      await queryRunner.query(
        `
          INSERT INTO \`restaurant_menu\` (
            \`restaurant_id\`, \`name\`, \`menu_category\`, \`unit\`,
            \`weight\`, \`unit_quantity\`, \`calories\`, \`carbs\`,
            \`sugars\`, \`sugar_alcohol\`, \`dietary_fiber\`, \`protein\`,
            \`fat\`, \`sat_fat\`, \`trans_fat\`, \`unsat_fat\`,
            \`sodium\`, \`caffeine\`, \`potassium\`, \`cholesterol\`,
            \`alcohol\`, \`source_key\`
          )
          SELECT ?, ?, ?, 0, NULL, '1인분', ?, NULL, NULL, NULL, NULL, NULL,
                 NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM \`restaurant_menu\`
            WHERE \`restaurant_id\` = ? AND \`name\` = ?
          )
        `,
        [
          restaurantId,
          name,
          menuCategory,
          calories,
          sourceKey(name),
          restaurantId,
          name,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`restaurant_menu\` WHERE \`source_key\` IN (${HANSOT_MENUS.map(() => '?').join(', ')})`,
      HANSOT_MENUS.map(([name]) => sourceKey(name)),
    );
    await queryRunner.query(
      `
        DELETE FROM \`restaurant\`
        WHERE \`name\` = '한솥'
          AND NOT EXISTS (
            SELECT 1 FROM \`restaurant_menu\`
            WHERE \`restaurant_id\` = \`restaurant\`.\`id\`
          )
      `,
    );
    await queryRunner.query(
      'ALTER TABLE `restaurant_menu` MODIFY `weight` decimal(12,3) NOT NULL',
    );
  }
}

#!/usr/bin/env python3
"""Normalize category/unit structure in menu-import-template.csv.

The script is intentionally idempotent. It also upserts completed Waffle
University waffles transcribed from the brand's official nutrition sheet.
Range-valued nutrition facts are represented by their midpoint because the
import schema accepts only one numeric value per nutrient.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "menu-import-template.csv"


BRAND_CATEGORY_GROUPS = {
    "피자": {
        "피자헛", "도미노피자", "피자스쿨", "피자마루", "피자나라치킨공주",
        "파파존스", "고피자", "피자에땅",
    },
    "치킨": {
        "BBQ", "굽네치킨", "KFC", "멕시카나치킨", "교촌치킨",
        "처갓집양념치킨", "BHC", "네네치킨", "자담치킨", "푸라닭치킨",
        "호식이두마리치킨", "지코바치킨",
    },
    "버거": {
        "롯데리아", "맥도날드", "맘스터치", "버거킹", "노브랜드버거",
        "프랭크버거", "파파이스",
    },
    "샌드위치/샐러드": {
        "샐러디", "써브웨이", "서브웨이", "퀴즈노스", "슬로우캘리",
        "샐러드박스", "샐러리아", "훅트포케", "프레퍼스 다이어트 푸드",
    },
    "카페": {
        "투썸플레이스", "메가커피", "스타벅스", "할리스", "공차", "빽다방",
        "컴포즈커피", "엔제리너스", "이디야커피", "커피빈", "파스쿠찌",
        "더벤티", "매머드커피", "폴바셋", "탐앤탐스", "달콤커피",
        "텐퍼센트커피", "팔공티",
    },
    "베이커리": {
        "파리바게뜨", "뚜레쥬르", "던킨도너츠", "크리스피크림도넛",
        "달콤왕가탕후루", "설빙", "와플대학", "송사부고로케",
        "앤티앤스 프레즐",
    },
}

BRAND_CATEGORY_BY_BRAND = {
    brand: category
    for category, brands in BRAND_CATEGORY_GROUPS.items()
    for brand in brands
}


def compact(value: str) -> str:
    return re.sub(r"\s+", "", value or "").lower()


def is_beverage(name: str) -> bool:
    n = compact(name)
    words = (
        "hot", "ice", "아이스", "라떼", "아메리카노", "카푸치노", "커피",
        "콜드브루", "콜드브류", "던카치노", "쿨라타", "슬러시", "에이드",
        "주스", "쥬스", "스무디", "밀크티", "아이스티", "초코드링크",
        "초코라떼", "티(hot)", "티(ice)", "펀치", "콜라", "사이다",
        "오렌지제로", "미숫가루", "쉐이크", "음료",
    )
    return any(word in n for word in words)


def set_food(row: dict[str, str], category: str, quantity: str = "인분") -> None:
    row["카테고리"] = category
    row["중량 단위"] = "0"
    row["단위량"] = quantity


def set_drink(row: dict[str, str]) -> None:
    row["카테고리"] = "음료"
    row["중량 단위"] = "1"
    row["단위량"] = "잔"


NUTRITION_FIELDS = (
    "칼로리", "탄수화물", "당류", "당알코올", "식이섬유", "단백질",
    "지방", "포화지방", "트랜스지방", "불포화지방", "나트륨", "카페인",
    "칼륨", "콜레스테롤", "알코올",
)


def format_number(value: float) -> str:
    rounded = round(value, 4)
    if rounded.is_integer():
        return str(int(rounded))
    return f"{rounded:.4f}".rstrip("0").rstrip(".")


def scale_nutrition(row: dict[str, str], ratio: float) -> None:
    """Scale every available nutrition value by the serving-weight ratio."""
    for field in NUTRITION_FIELDS:
        raw = row.get(field, "").strip()
        if not raw:
            continue
        try:
            row[field] = format_number(float(raw) * ratio)
        except ValueError:
            # Keep source annotations/ranges untouched instead of guessing.
            continue


def chicken_piece_weight(name: str) -> int:
    """Return a practical average cooked weight for one chicken piece."""
    n = compact(name)
    if any(word in n for word in ("윙", "봉")):
        return 30
    if any(word in n for word in ("순살", "텐더", "안심", "너겟")):
        return 30
    if any(word in n for word in ("다리", "장각", "스틱")):
        return 80
    if "콤보" in n:
        return 60
    return 75


def normalize_chicken_serving(row: dict[str, str]) -> None:
    """Convert legacy per-100 g chicken rows into an average per-piece row.

    Some imports already said ``1조각`` while retaining the source's 100 g
    nutrition basis. They are included together with legacy ``기준량`` rows.
    """
    category = row["카테고리"].strip()
    name = row["메뉴"].strip()
    quantity = row["단위량"].strip()

    if category == "닭꼬치":
        row["중량 단위"] = "0"
        row["단위량"] = "1개"
        return

    # These GoPizza products are sold as one composed serving, not one piece.
    if row["브랜드"].strip() == "고피자" and name in {
        "순살치킨 앤 프라이", "크리스피 빠삭치킨",
    }:
        set_food(row, "치킨", "인분")
        return

    if category not in {"치킨", "치킨류"}:
        return

    try:
        source_weight = float(row["중량"].strip())
    except ValueError:
        return

    if source_weight != 100 or quantity not in {"기준량", "조각", "1조각"}:
        return

    # These rows describe a set/add-on rather than a physical chicken piece.
    # Keep their 100 g source values, but do not mislabel 100 g as one piece.
    if any(word in compact(name) for word in (
        "세트메뉴", "콜팝", "폭립", "비스킷", "치킨톡", "소스",
    )):
        row["중량 단위"] = "0"
        row["단위량"] = "인분"
        return

    target_weight = chicken_piece_weight(name)
    scale_nutrition(row, target_weight / source_weight)
    row["중량 단위"] = "0"
    row["중량"] = str(target_weight)
    row["단위량"] = "1조각"


def normalize_legacy_basis_quantity(row: dict[str, str]) -> None:
    """Replace the legacy ``기준량`` placeholder with a concrete serving label.

    Per-100 g source data stays labelled as 100 g unless the menu name or the
    brand's existing records provide a reliable purchasable-unit label. This
    avoids presenting a source nutrition basis as one whole serving.
    """
    brand = row["브랜드"].strip()
    category = row["카테고리"].strip()
    name = row["메뉴"].strip()
    n = compact(name)
    quantity = row["단위량"].strip()

    # Preserve the source unit for Compose food/dessert records. Although the
    # products are solid food, changing this field is outside this cleanup.
    if brand == "컴포즈커피" and category == "푸드ㆍ디저트":
        row["중량 단위"] = "1"

    if brand == "BBQ" and (
        is_beverage(name) or any(word in n for word in ("스프라이트", "레몬보이"))
    ) and quantity in {"기준량", "100g", "인분"}:
        row["단위량"] = "잔"
        return

    unknown_piece_chicken = {
        ("BHC", "치킨스넥"),
        ("피자마루", "고추마요 텐더치킨"),
        ("피자스쿨", "치킨스틱&#038;윙 (치킨스틱&윙)"),
        ("피자스쿨", "치킨텐더 (치킨텐더)"),
    }
    if (brand, name) in unknown_piece_chicken and quantity in {"기준량", "100g", "인분"}:
        source_weight = float(row["중량"])
        target_weight = 30
        scale_nutrition(row, target_weight / source_weight)
        row["중량"] = str(target_weight)
        row["단위량"] = "1조각"
        return

    if quantity not in {"기준량", "100g"}:
        return

    if brand == "BHC" and "피자" in name:
        source_weight = float(row["중량"])
        target_weight = 110
        scale_nutrition(row, target_weight / source_weight)
        set_food(row, "피자", "1조각")
        row["중량"] = str(target_weight)
        return

    if brand == "네네치킨" and category == "피자":
        source_weight = float(row["중량"])
        target_weight = 82 if "(씬)" in name else 113
        scale_nutrition(row, target_weight / source_weight)
        row["중량"] = str(target_weight)
        row["단위량"] = "1조각"
        return

    # Counts explicitly printed in official menu names are the strongest unit
    # evidence. Chicken/tender products use 조각; other products use 개.
    count_match = re.search(r"(?:\(|\s)(\d+)\s*(개|조각|ea)(?:\)|\s|$)", name, re.IGNORECASE)
    if count_match:
        count, raw_unit = count_match.groups()
        unit = "조각" if raw_unit == "조각" else "개"
        row["단위량"] = f"{count}{unit}"
        return

    if brand == "컴포즈커피":
        row["단위량"] = "1조각" if "(조각)" in name else "1개"
        return

    if brand == "고피자":
        if category == "피자":
            if "1인피자세트" in n:
                row["단위량"] = "인분"
            elif "소스" in n:
                row["단위량"] = "1회"
            else:
                row["단위량"] = "1조각"
        elif any(word in n for word in ("소스", "시즈닝", "치즈추가", "무스", "연유")):
            row["단위량"] = "1회"
        elif "피클" in n:
            row["단위량"] = "1개"
        else:
            row["단위량"] = "인분"
        return

    if brand == "피자스쿨" and category == "피자":
        row["단위량"] = "2조각"
        return

    if category in {"소스", "추가토핑 ®"} or any(
        word in n for word in ("소스", "시즈닝", "스프레드", "토핑")
    ):
        row["단위량"] = "1회"
        return

    if category == "피자설기":
        row["단위량"] = "1개"
        return

    row["단위량"] = "잔" if is_beverage(name) else "인분"


def classify_frank(row: dict[str, str]) -> None:
    if row["카테고리"] != "사이드&음료":
        return
    name = row["메뉴"]
    if any(x in name for x in ("케첩", "머스타드", "양념소스")):
        set_food(row, "소스", "1개")
    elif is_beverage(name):
        set_drink(row)
    else:
        match = re.search(r"\((\d+)(?:\+(\d+))?개\)", name)
        count = sum(int(x) for x in match.groups() if x) if match else None
        set_food(row, "사이드", f"{count}개" if count else "인분")


def classify_popeyes(row: dict[str, str]) -> None:
    if row["카테고리"] != "샌드위치/버거":
        return
    name = row["메뉴"]
    category = "샌드위치" if "샌드위치" in name else "랩" if "랩" in name else "버거"
    set_food(row, category)


def classify_salady(row: dict[str, str]) -> None:
    name = row["메뉴"]
    if name == "스프라이트제로":
        set_food(row, "수프·스튜")
        return
    if row["카테고리"] == "포케·비빔밥":
        row["카테고리"] = "비빔밥" if "비빔밥" in name else "포케"
    if is_beverage(name) or row["카테고리"] == "음료":
        set_drink(row)
    else:
        row["중량 단위"] = "0"
        row["단위량"] = "인분"


def classify_subway(row: dict[str, str]) -> None:
    name = row["메뉴"]
    if row["카테고리"] == "랩·기타":
        set_food(row, "랩")
        return
    if row["카테고리"] != "사이드·음료":
        if not is_beverage(name):
            row["중량 단위"] = "0"
        return
    if "수프" in name:
        set_food(row, "수프")
    elif "랩" in name:
        set_food(row, "랩")
    elif any(x in name for x in ("초코칩", "레이즌", "마카다미아", "치즈케익")):
        set_food(row, "쿠키", "1개")
    else:
        set_food(row, "사이드")


def classify_krispy(row: dict[str, str]) -> None:
    name = row["메뉴"]
    if is_beverage(name) or row["카테고리"] in {"커피", "스무디"}:
        set_drink(row)
        return
    if row["카테고리"] != "도넛/음료":
        quantity = "인분" if any(x in name for x in ("더즌", "세트", "팩")) else "1개"
        set_food(row, "도넛", quantity)
        return
    quantity = "인분" if any(x in name for x in ("더즌", "세트", "팩")) else "1개"
    set_food(row, "도넛", quantity)


def classify_dunkin(row: dict[str, str]) -> None:
    name = row["메뉴"]
    n = compact(name)
    if is_beverage(name) or row["카테고리"] in {"커피", "티&에이드", "쿨라타", "기타 음료"}:
        set_drink(row)
        return
    if row["카테고리"] in {"샐러드", "샐러드·볼"}:
        set_food(row, "샐러드·볼")
        return
    if "샌드위치" in row["카테고리"] or "핫도그" in n:
        set_food(row, "샌드위치")
        return
    if row["카테고리"] == "베이커리&디저트":
        set_food(row, "베이커리", "1개")
        return
    if row["카테고리"] in {"WONDERS", "컬렉션", "클래식", "신제품"}:
        if any(x in n for x in ("도넛", "먼치킨", "글레이즈드", "크림")):
            quantity = "인분" if any(x in n for x in ("세트", "팩", "더즌")) else "1개"
            set_food(row, "도넛", quantity)
        else:
            set_food(row, "푸드")
        return
    if row["카테고리"] != "기타":
        # Preserve already meaningful categories, but correct solid-food units.
        if row["카테고리"] not in {"음료"}:
            row["중량 단위"] = "0"
        return
    if any(x in n for x in ("샐러드", "비빔볼", "콥볼", "볼샐러드")):
        set_food(row, "샐러드·볼")
    elif "랩" in n or "브리또" in n:
        set_food(row, "랩")
    elif any(x in n for x in ("샌드위치", "크로크", "핫도그", "브레드위치")):
        set_food(row, "샌드위치")
    elif any(x in n for x in ("도넛", "츄이스티", "먼치킨", "후리터", "하니딥", "핑크링", "올드훼션드")):
        quantity = "인분" if any(x in n for x in ("더즌", "세트", "팩")) else "1개"
        set_food(row, "도넛", quantity)
    elif any(x in n for x in (
        "베이글", "머핀", "크루아상", "크로와상", "파이", "쿠키", "브레드",
        "치아바타", "케익", "케이크", "카스테라", "타르트", "퀸아망", "소시지롤",
        "스콘", "바게트", "토스트",
    )):
        set_food(row, "베이커리", "1개")
    else:
        # Remaining Dunkin records are food products, not millilitre servings.
        set_food(row, "푸드")


def classify_yoajung(row: dict[str, str]) -> None:
    name = row["메뉴"]
    n = compact(name)
    if "빙수" in n:
        category = "빙수"
    elif "아사이" in n or "허니샤인베리망고" in n:
        category = "아사이"
    elif "그릭" in n:
        category = "그릭요거트"
    elif re.search(r"(?:100g|50g|1개|1/2)", n) and any(
        fruit in n for fruit in ("망고", "멜론", "수박", "딸기", "자몽", "샤인머스캣", "바나나")
    ):
        category = "과일"
    else:
        category = "요거트아이스크림"
    set_food(row, category)


def classify_paik(row: dict[str, str]) -> None:
    if row["카테고리"] != "아이스크림/디저트":
        return
    name = row["메뉴"]
    if "빙수" in name:
        set_food(row, "빙수")
    elif "빵" in name:
        set_food(row, "베이커리", "1개")
    elif any(x in name for x in ("소프트", "아이스크림")):
        set_food(row, "아이스크림")
    elif "아포가토" in name:
        set_food(row, "디저트")
    else:
        set_food(row, "디저트", "1개")


def classify_momstouch(row: dict[str, str]) -> None:
    if row["카테고리"] != "음료/토핑류":
        return
    if "토핑" in row["메뉴"]:
        set_food(row, "토핑", "1회")
    else:
        set_drink(row)


def midpoint(value: str) -> str:
    if not value:
        return ""
    if "-" not in value:
        return value
    left, right = (float(x) for x in value.split("-", 1))
    result = (left + right) / 2
    return str(int(result)) if result.is_integer() else f"{result:.2f}".rstrip("0").rstrip(".")


# name, weight, kcal, sodium, sugar, saturated fat, protein
WAFFLES = [
    ("플레인와플", "55-60", "192-209", "253-276", "6", "2.1-2.3", "3"),
    ("블루베리와플", "55-60", "191-208", "253-273", "4-5", "2.4-2.6", "3-4"),
    ("크림와플", "85-155", "252-565", "252-459", "17-43", "5.4-18", "3-7"),
    ("스노우와플", "95-180", "329-524", "265-414", "15-40", "9-20", "3-6"),
    ("메이플시나몬와플", "75-90", "227-335", "219-281", "14-20", "2.4-5.5", "3-5"),
    ("애플시나몬와플", "95-130", "269-450", "269-337", "10-19", "4.4-12", "4-5"),
    ("추억의사과잼와플", "105-110", "351-366", "278-331", "23-28", "6-7", "3"),
    ("추억의딸기잼와플", "105-110", "339-362", "270-280", "24-31", "6-7", "3"),
    ("허니브레드와플", "86-121", "243-432", "261-336", "13-25", "5-13", "3-5"),
    ("해피치즈딥바나나와플", "105-110", "292-311", "280-304", "15-17", "4.0-4.2", "3-4"),
    ("호두고구마와플", "120-155", "377-521", "348-381", "16-23", "4.5-12", "7-8"),
    ("치즈케이크&크랜베리와플", "113-128", "420-507", "330-354", "25-30", "9-12", "4-5"),
    ("딸기케이크와플", "128-163", "286-429", "303-336", "13-20", "6-13", "5-6"),
    ("딸기듬뿍와플", "185-220", "384-537", "288-356", "21-33", "7-16", "4-6"),
    ("트리플초코와플", "117-152", "390-604", "307-382", "14-21", "13-24", "4-6"),
    ("크런치딸기잼와플", "100-135", "329-498", "299-345", "16-28", "6-13", "4-6"),
    ("더티초코케이크와플", "137-172", "505-648", "302-335", "28-35", "17-24", "4-6"),
    ("베리베리케이크와플", "143-178", "470-665", "305-355", "24-35", "15-27", "4-5"),
    ("모카케이크와플", "155-170", "549-677", "356-400", "24-37", "18-27", "5-7"),
    ("해피피스타치오크런치와플", "140-145", "430-450", "288-323", "22-25", "14", "4"),
    ("해피치즈딥메이플크림와플", "165-170", "489-507", "293-317", "33-35", "14", "4"),
    ("바나나와플", "150-165", "408-503", "327-351", "25-30", "8-11", "3-6"),
    ("베리베리와플", "90-135", "257-455", "270-311", "16-31", "4.4-12", "3-5"),
    ("딸기와플", "130-145", "349-470", "341-366", "19-24", "8-12", "3-5"),
    ("오레오누텔라와플", "97-132", "346-534", "237-365", "16-27", "7-14", "5-7"),
    ("바나나누텔라와플", "150-185", "383-552", "274-319", "19-31", "6-15", "5-7"),
    ("딸기누텔라와플", "130-165", "328-539", "272-328", "14-27", "6-15", "5-7"),
    ("젤라또와플", "165-230", "341-508", "322-433", "18-44", "4.6-11", "5-9"),
    ("크림젤라또와플", "195-265", "444-663", "332-474", "24-60", "11-23", "2-8"),
    ("블루베리젤라또와플", "180-205", "371-537", "320-374", "26-49", "4.6-10", "5-8"),
    ("베리베리젤라또와플", "190-215", "394-564", "322-368", "32-55", "4.4-10", "5-8"),
    ("오레오누텔라젤라또와플", "197-212", "484-624", "373-442", "32-46", "8-14", "7-10"),
    ("치즈케이크누텔라젤라또와플", "209-224", "520-649", "360-418", "38-50", "8-15", "7-11"),
    ("딸기누텔라젤라또와플", "230-245", "472-595", "343-391", "36-48", "6-13", "6-10"),
    ("초코범벅와플", "210-235", "591-711", "378-422", "46-59", "13-17", "7-9"),
    ("딸기범벅와플", "245-270", "561-677", "363-399", "38-55", "12-15", "5-7"),
    ("블루베리범벅와플", "212-237", "552-674", "348-400", "44-58", "11-16", "6-7"),
    ("치즈범벅와플", "219-244", "621-747", "416-448", "44-57", "17-21", "7-8"),
    ("망고범벅와플", "265-290", "597-709", "365-411", "44-63", "12-16", "6-7"),
    ("크런치딸기잼젤라또와플", "210-225", "484-626", "364-459", "35-49", "7-13", "7-10"),
    ("솜사탕젤라또와플", "173-178", "419-422", "277-309", "30-33", "7-8", "6"),
    ("해피치즈딥누텔라젤라또와플", "245-250", "600-660", "337-395", "46-55", "10-13", "7-9"),
    ("토피토피넛젤라또와플", "210-225", "546-676", "324-382", "37-49", "7-13", "10-13"),
    ("딸바누텔라젤라또와플", "295-310", "512-641", "308-366", "42-54", "6-12", "7-11"),
    ("두바이초코와플", "152-157", "690-709", "352-375", "26-28", "13-14", "9"),
    ("두바이초코 스노우와플", "162-207", "715-846", "351-392", "24-31", "16-25", "9"),
    ("우베 스노우 와플", "155-180", "512-573", "358-390", "24-29", "4.9-9", "5"),
    ("우베 젤라또 와플", "240-245", "586-605", "412-435", "41-43", "8", "7-8"),
    ("후르츠 말랑떡 요거트 스노우와플", "195-270", "485-709", "351-467", "34-71", "6-10", "4-5"),
    ("자몽 말랑떡 요거트 젤라또와플", "265-320", "598-766", "405-512", "48-82", "8", "6"),
    ("청포도 말랑떡 요거트 젤라또와플", "255-310", "573-740", "390-497", "47-82", "8", "5-6"),
]


# category, name, weight(g), kcal, protein(g), saturated fat(g), sugar(g),
# sodium(mg), serving label. The official Subway table does not publish total
# carbohydrate/fat for these components, so those fields intentionally remain
# blank instead of being inferred.
SUBWAY_COMPONENTS = [
    # 빵
    ("빵", "플랫 브레드", 86, 232, 8, 0.9, 1.9, 465, "1개"),
    ("빵", "허니 오트", 79.6, 237, 7, 0.4, 2.7, 320, "1개"),
    ("빵", "파마산 오레가노", 70.5, 207, 7.6, 0.4, 3.1, 384, "1개"),
    ("빵", "위트", 69, 195, 7.5, 0.3, 2.6, 271, "1개"),
    ("빵", "화이트", 67, 195, 7.4, 0.3, 2.7, 239, "1개"),
    ("빵", "통밀랩", 64.5, 184, 5.1, 2.4, 2, 514, "1개"),
    ("빵", "그레인", 73, 213, 8.4, 0.5, 2.8, 303, "1개"),
    ("빵", "꼬마빵", 33.5, 98, 3.7, 0.2, 1.3, 119, "1개"),

    # 추가선택
    ("토핑", "아보카도", 30, 56.5, 0.6, 0.8, 0.4, 88.9, "1회"),
    ("토핑", "베이컨 비츠", 10, 53, 3.5, 1.4, 0.2, 225, "1회"),
    ("토핑", "베이컨", 9, 45.8, 3.3, 1.6, 0.1, 202, "1회"),
    ("토핑", "에그마요", 75, 207, 7.2, 4.2, 0.1, 292, "1회"),
    ("토핑", "오믈렛", 65, 65, 5.2, 0.6, 0.7, 293, "1회"),
    ("토핑", "페퍼로니", 12, 54.1, 2.4, 1.8, 0.4, 219, "1회"),
    ("토핑", "고메인 믹스", 80, 148, 5.6, 0.4, 0.8, 56, "1회"),
    ("토핑", "후무스", 36, 98, 2.6, 1, 0.93, 110, "1회"),

    # 소스 & 드레싱
    ("소스", "허니 머스타드", 21, 38.4, 0.4, 0.4, 6.3, 145, "1회"),
    ("소스", "홀스래디쉬", 21, 106, 0.3, 1.6, 2.6, 152, "1회"),
    ("소스", "핫 칠리", 21, 41.8, 0.2, 0.1, 5.3, 180, "1회"),
    ("소스", "마요네즈", 21, 158, 0.3, 2.8, 0.1, 98.1, "1회"),
    ("소스", "엑스트라 버진 올리브 오일", 3.5, 29, 0, 0.5, 0, 0, "1회"),
    ("소스", "랜치", 21, 116, 0.2, 2.1, 0.6, 128, "1회"),
    ("소스", "레드와인 식초", 3.5, 0.7, 0, 0, 0, 0, "1회"),
    ("소스", "스모크 바비큐", 21, 32.8, 0.2, 0.1, 7, 132, "1회"),
    ("소스", "사우스웨스트 치폴레", 21, 96.5, 0.4, 1.6, 1, 160, "1회"),
    ("소스", "스위트 칠리", 21, 40, 0.1, 0, 9.2, 163, "1회"),
    ("소스", "스위트 어니언", 21, 40.1, 0.1, 0, 8.2, 81.7, "1회"),
    ("소스", "저당 크리미 어니언", 21, 51, 0.1, 1, 0.6, 89, "1회"),
    ("소스", "저칼로리 오리엔탈", 21, 4, 0.3, 0, 0.1, 235.1, "1회"),
    ("소스", "치미추리", 21, 42, 0.15, 0.5, 1, 220, "1회"),

    # 치즈
    ("치즈", "아메리칸 치즈", 10, 35.3, 1.8, 1.9, 0.4, 193, "1회"),
    ("치즈", "슈레드 치즈", 14, 53.6, 3.2, 2.4, 0, 84.7, "1회"),
    ("치즈", "모차렐라 치즈", 14, 43.8, 2.8, 2.1, 0.2, 82.3, "1회"),

    # 기타 채소
    ("야채", "오이", 10, 1.5, 0.1, 0, 0.2, 0.2, "1회"),
    ("야채", "피망", 7, 1.4, 0.1, 0, 0.2, 0, "1회"),
    ("야채", "할라피뇨", 6, 0.6, 0, 0, 0.1, 33.5, "1회"),
    ("야채", "양상추", 21, 2.9, 0.2, 0, 0.4, 2.1, "1회"),
    ("야채", "올리브", 3, 3.9, 0, 0, 0, 0, "1회"),
    ("야채", "양파", 7, 2.8, 0.1, 0, 0.3, 0.3, "1회"),
    ("야채", "피클", 9.5, 0.4, 0, 0, 0.2, 76.2, "1회"),
    ("야채", "토마토", 40.7, 7.7, 0.4, 0, 1.6, 2, "1회"),
]


def subway_component_row(
    fieldnames: list[str], spec: tuple[str, str, float, float, float, float, float, float, str]
) -> dict[str, str]:
    category, name, weight, kcal, protein, sat_fat, sugar, sodium, quantity = spec
    row = {field: "" for field in fieldnames}
    row.update({
        "메뉴": name,
        "브랜드": "써브웨이",
        "카테고리": category,
        "중량 단위": "0",
        "중량": format_number(float(weight)),
        "단위량": quantity,
        "칼로리": format_number(float(kcal)),
        "당류": format_number(float(sugar)),
        "단백질": format_number(float(protein)),
        "포화지방": format_number(float(sat_fat)),
        "나트륨": format_number(float(sodium)),
    })
    return row


def waffle_row(fieldnames: list[str], spec: tuple[str, ...]) -> dict[str, str]:
    name, weight, kcal, sodium, sugar, sat_fat, protein = spec
    row = {field: "" for field in fieldnames}
    row.update({
        "메뉴": name,
        "브랜드": "와플대학",
        "카테고리": "와플",
        "중량 단위": "0",
        "중량": midpoint(weight),
        "단위량": "인분",
        "칼로리": midpoint(kcal),
        "당류": midpoint(sugar),
        "단백질": midpoint(protein),
        "포화지방": midpoint(sat_fat),
        "나트륨": midpoint(sodium),
    })
    return row


def main() -> None:
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        source_fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    # Keep the existing normalization helpers working with their original
    # internal key while accepting both the old and new CSV schemas.
    if "메뉴 카테고리" in source_fieldnames:
        fieldnames = [
            "카테고리" if field == "메뉴 카테고리" else field
            for field in source_fieldnames
            if field != "브랜드 카테고리"
        ]
        for row in rows:
            row["카테고리"] = row.pop("메뉴 카테고리", "")
            row.pop("브랜드 카테고리", None)
    else:
        fieldnames = source_fieldnames

    # 요아정 데이터는 현재 수집본 전체를 사용하지 않기로 했으므로 제거한다.
    # 이 필터를 유지해 스크립트를 다시 실행해도 CSV에 남지 않게 한다.
    before_excluded_brand_count = len(rows)
    rows = [row for row in rows if row["브랜드"].strip() != "요아정"]
    excluded_yoajung = before_excluded_brand_count - len(rows)

    for row in rows:
        brand = row["브랜드"].strip()
        if brand == "프랭크버거":
            classify_frank(row)
        elif brand == "파파이스":
            classify_popeyes(row)
        elif brand == "샐러디":
            classify_salady(row)
        elif brand in {"써브웨이", "서브웨이"}:
            classify_subway(row)
        elif brand == "크리스피크림도넛":
            classify_krispy(row)
        elif brand == "던킨도너츠":
            classify_dunkin(row)
        elif brand == "와플대학":
            if row["카테고리"] == "음료":
                set_drink(row)
            else:
                row["중량 단위"] = "0"
        elif brand == "빽다방":
            classify_paik(row)
        elif brand == "맘스터치":
            classify_momstouch(row)
        elif brand == "버거킹" and row["카테고리"] == "음료&디저트":
            set_drink(row)
        elif brand == "BBQ" and row["카테고리"] == "피자/버거":
            set_food(row, "피자")

        normalize_chicken_serving(row)
        normalize_legacy_basis_quantity(row)

    # Cross-brand schema invariants. These repair legacy imports where the
    # numeric g/ml flag was written into the opposite semantic slot.
    solid_categories = {
        "와플", "도넛", "버거", "샌드위치", "랩", "포케", "비빔밥",
        "샐러드", "샐러드·볼", "베이커리", "사이드", "치킨", "치킨류",
        "닭꼬치", "피자", "빵", "치즈", "야채",
        "토핑", "소스", "쿠키", "수프", "빙수", "아이스크림", "디저트",
        "푸드", "그릭요거트", "요거트아이스크림", "아사이", "과일",
    }
    for row in rows:
        if row["카테고리"] == "음료":
            row["중량 단위"] = "1"
            row["단위량"] = "잔"
        elif row["카테고리"] in solid_categories:
            row["중량 단위"] = "0"

    index = {(row["브랜드"].strip(), compact(row["메뉴"])): i for i, row in enumerate(rows)}
    inserted = 0
    updated = 0
    for spec in WAFFLES:
        row = waffle_row(fieldnames, spec)
        key = (row["브랜드"], compact(row["메뉴"]))
        if key in index:
            rows[index[key]].update(row)
            updated += 1
        else:
            index[key] = len(rows)
            rows.append(row)
            inserted += 1

    # A component may legitimately share its name with a finished menu
    # (for example, the 에그마요 topping and 에그마요 sandwich). Therefore,
    # Subway components are keyed by category as well as brand and name.
    component_index = {
        (
            row["브랜드"].strip(),
            row["카테고리"].strip(),
            compact(row["메뉴"]),
        ): i
        for i, row in enumerate(rows)
    }
    subway_inserted = 0
    subway_updated = 0
    for spec in SUBWAY_COMPONENTS:
        row = subway_component_row(fieldnames, spec)
        key = (row["브랜드"], row["카테고리"], compact(row["메뉴"]))
        if key in component_index:
            rows[component_index[key]].update(row)
            subway_updated += 1
        else:
            component_index[key] = len(rows)
            rows.append(row)
            subway_inserted += 1

    # The restaurant-tab grouping is intentionally allowlist-only. Unknown
    # brands stay blank instead of being inferred from their names or menus.
    for row in rows:
        row["브랜드 카테고리"] = BRAND_CATEGORY_BY_BRAND.get(
            row["브랜드"].strip(), ""
        )

    output_fieldnames: list[str] = []
    for field in fieldnames:
        if field == "카테고리":
            output_fieldnames.extend(["브랜드 카테고리", "메뉴 카테고리"])
        else:
            output_fieldnames.append(field)

    output_rows = []
    for row in rows:
        output_row = {}
        for field in output_fieldnames:
            if field == "메뉴 카테고리":
                output_row[field] = row.get("카테고리", "")
            else:
                output_row[field] = row.get(field, "")
        output_rows.append(output_row)

    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=output_fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(output_rows)

    print(
        f"rows={len(rows)} "
        f"excluded_yoajung={excluded_yoajung} "
        f"waffle_inserted={inserted} waffle_updated={updated} "
        f"subway_inserted={subway_inserted} subway_updated={subway_updated}"
    )


if __name__ == "__main__":
    main()

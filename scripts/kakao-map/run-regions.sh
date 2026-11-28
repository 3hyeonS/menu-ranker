#!/usr/bin/env bash
# 지역 목록 파일(폴더<TAB>사각형;사각형…<TAB>주소 필터)대로 카카오 수집을 지역별로 병렬 실행한다. 이슈 #47(수도권)·#49(광역시·세종).
# 지역 목록: scripts/kakao-map/regions/capital-area.tsv, metro-area.tsv
# 서울 수집(메인 체크아웃 kakao-map/run-discover.sh·run-menus.sh)과 같은 방식이다. 문서: docs/kakao-map-menu-crawler.md
#
# 사용: scripts/kakao-map/run-regions.sh <discover|menus> <지역 목록.tsv> [동시 실행 지역 수]
#   discover  음식점(FD6) 장소 목록만(공식 로컬 API). 기본 10개 지역 동시
#   menus     음식점 목록 + 메뉴(panel3, 지역마다 동시 1·1~3초 간격). 기본 3개 지역 동시
# 카페(CE7)는 #47 결정(2026-11-27)으로 보류해 모드를 두지 않는다.
# 환경변수
#   ONLY=<정규식>      폴더가 이 정규식(awk ERE)에 맞는 지역만. 예: ONLY='^인천/', ONLY='^(광주|세종)/'
#   KAKAO_MAP_DIR=<폴더> 결과 루트. 기본은 이 저장소의 kakao-map/. worktree에서는 반드시 메인 체크아웃 경로를 준다.
# 결과: <루트>/<폴더>/, 로그: 결과 폴더 옆 <폴더>-<모드>.log
# 같은 명령을 다시 실행하면 지역마다 이어서 한다(끝난 사각형·식당은 건너뜀).
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)

run_one() {
  local line=$1 folder rects filter dir
  IFS=$'\t' read -r folder rects filter <<<"$line"
  dir="$OUT_ROOT/$folder"
  local args=("--district=$filter" "--rect=$rects" "--exclude-categories=$EX")
  [[ $MODE == discover ]] && args+=(--discover-only)
  mkdir -p "$(dirname "$dir")"
  (cd "$ROOT" && npm run --silent kakao-map:crawl-songpa -- "--out-dir=$dir" "${args[@]}") >"$dir-$MODE.log" 2>&1
  local code=$? note=
  # 크롤러는 재시도를 소진한 사각형·식당이 있어도 경고만 하고 0으로 끝난다. 빠진 데이터가 묻히지 않게 실패로 센다.
  # 다시 실행하면 그 사각형·식당만 다시 요청한다(없는 장소 404·410은 완료로 남아 다음 실행에서 0이 된다).
  if [[ $code -eq 0 ]] && grep -qE '"failed(Rects|Places)": [1-9]' "$dir-$MODE.log"; then
    code=3
    note=" ($(grep -oE '"failed(Rects|Places)": [0-9]+' "$dir-$MODE.log" | tr -d '"' | paste -sd' '), 같은 명령으로 다시 실행)"
  fi
  echo "$folder $MODE exit $code$note $(date +%m-%d\ %H:%M)"
  return "$code"
}

if [[ ${1:-} == __one ]]; then
  run_one "$2"
  exit
fi

MODE=${1:-}
LIST=${2:-}
case $MODE in
discover) PARALLEL=${3:-10} ;;
menus) PARALLEL=${3:-3} ;;
*)
  echo "사용: $0 <discover|menus> <지역 목록.tsv> [동시 실행 지역 수]" >&2
  exit 2
  ;;
esac
[[ -f $LIST ]] || {
  echo "지역 목록 파일이 없습니다: $LIST" >&2
  exit 2
}
[[ $PARALLEL =~ ^[1-9][0-9]*$ ]] || {
  echo "동시 실행 지역 수는 1 이상의 정수여야 합니다: $PARALLEL" >&2
  exit 2
}

# 크롤러는 $ROOT에서 돌므로 상대 경로는 지금 폴더 기준 절대 경로로 바꿔 둔다.
OUT_ROOT=$(realpath -m "${KAKAO_MAP_DIR:-$ROOT/kakao-map}")
# worktree 안 kakao-map/은 worktree를 정리할 때 함께 지워진다.
# 확인에 실패하면(오래된 git 등) 지나치지 않고 멈춘다.
GIT_DIR=$(cd "$ROOT" && git rev-parse --git-dir 2>/dev/null)
GIT_COMMON_DIR=$(cd "$ROOT" && git rev-parse --git-common-dir 2>/dev/null)
if [[ -z $GIT_DIR || -z $GIT_COMMON_DIR ]]; then
  echo "git 저장소를 확인하지 못했습니다: $ROOT" >&2
  exit 2
fi
GIT_DIR=$(cd "$ROOT" && realpath -m "$GIT_DIR")
GIT_COMMON_DIR=$(cd "$ROOT" && realpath -m "$GIT_COMMON_DIR")
if [[ -z ${KAKAO_MAP_DIR:-} && $GIT_DIR != "$GIT_COMMON_DIR" ]]; then
  echo "worktree에서 실행 중입니다. 결과가 정리 때 지워지지 않도록 KAKAO_MAP_DIR=<메인 체크아웃>/kakao-map 을 주세요." >&2
  exit 2
fi

# 서울 수집과 같은 제외 단어(기본값 + 간식)를 쓴다.
EX_FILE="$OUT_ROOT/exclude-categories.txt"
[[ -s $EX_FILE ]] || {
  echo "제외 카테고리 파일이 없습니다: $EX_FILE (서울 수집에 쓴 파일)" >&2
  exit 2
}
EX=$(tr -d '\r\n' <"$EX_FILE")

# awk -v는 값의 백슬래시를 먼저 풀어 버리므로 ENVIRON으로 읽는다.
LINES=$(grep -v -e '^#' -e '^[[:space:]]*$' "$LIST" | ONLY="${ONLY:-}" awk -F'\t' 'ENVIRON["ONLY"] == "" || $1 ~ ENVIRON["ONLY"]')
[[ -n $LINES ]] || {
  echo "실행할 지역이 없습니다(ONLY=${ONLY:-})" >&2
  exit 2
}
if awk -F'\t' 'NF != 3 || $1 == "" || $2 == "" || $3 == "" { bad = 1 } END { exit !bad }' <<<"$LINES"; then
  echo "지역 목록은 폴더<TAB>사각형<TAB>주소 필터 3칸이어야 합니다: $LIST" >&2
  exit 2
fi

echo "모드 $MODE, 지역 $(wc -l <<<"$LINES")개, 동시 $PARALLEL, 결과 루트 $OUT_ROOT"
export MODE OUT_ROOT EX ROOT
xargs -d '\n' -n 1 -P "$PARALLEL" bash "$0" __one <<<"$LINES"
status=$?
[[ $status -eq 0 ]] && echo "모든 지역 완료" || echo "실패한 지역이 있습니다(exit $status). 위 exit 줄과 로그를 확인하고 같은 명령으로 다시 실행하세요."
exit "$status"

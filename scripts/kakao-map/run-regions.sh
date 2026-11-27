#!/usr/bin/env bash
# 지역 목록 파일(폴더<TAB>사각형;사각형…<TAB>주소 필터)대로 카카오 수집을 지역별로 병렬 실행한다. 이슈 #47.
# 서울 수집(메인 체크아웃 kakao-map/run-discover.sh·run-menus.sh)과 같은 방식이다. 문서: docs/kakao-map-menu-crawler.md
#
# 사용: scripts/kakao-map/run-regions.sh <discover|menus|cafe> <지역 목록.tsv> [동시 실행 지역 수]
#   discover  음식점(FD6) 장소 목록만(공식 로컬 API). 기본 10개 지역 동시
#   menus     음식점 목록 + 메뉴(panel3, 지역마다 동시 1·1~3초 간격). 기본 3개 지역 동시
#   cafe      카페(CE7) 장소 목록만(제외 필터 없음). 기본 10개 지역 동시
# 환경변수
#   ONLY=<정규식>      폴더가 이 정규식(awk ERE)에 맞는 지역만. 예: ONLY='^인천/'
#   KAKAO_MAP_DIR=<폴더> 결과 루트. 기본은 이 저장소의 kakao-map/. worktree에서는 반드시 메인 체크아웃 경로를 준다.
# 결과: <루트>/<폴더>/ (cafe는 <루트>/cafe/<폴더>/), 로그: 결과 폴더 옆 <폴더>-<모드>.log
# 같은 명령을 다시 실행하면 지역마다 이어서 한다(끝난 사각형·식당은 건너뜀).
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)

run_one() {
  local line=$1 folder rects filter dir
  IFS=$'\t' read -r folder rects filter <<<"$line"
  local args=("--district=$filter" "--rect=$rects")
  case $MODE in
  discover)
    dir="$OUT_ROOT/$folder"
    args+=(--discover-only "--exclude-categories=$EX")
    ;;
  menus)
    dir="$OUT_ROOT/$folder"
    args+=("--exclude-categories=$EX")
    ;;
  cafe)
    dir="$OUT_ROOT/cafe/$folder"
    args+=(--category-group=CE7)
    ;;
  esac
  mkdir -p "$(dirname "$dir")"
  (cd "$ROOT" && npm run --silent kakao-map:crawl-songpa -- "--out-dir=$dir" "${args[@]}") >"$dir-$MODE.log" 2>&1
  local code=$?
  echo "$folder $MODE exit $code $(date +%m-%d\ %H:%M)"
  return "$code"
}

if [[ ${1:-} == __one ]]; then
  run_one "$2"
  exit
fi

MODE=${1:-}
LIST=${2:-}
case $MODE in
discover | cafe) PARALLEL=${3:-10} ;;
menus) PARALLEL=${3:-3} ;;
*)
  echo "사용: $0 <discover|menus|cafe> <지역 목록.tsv> [동시 실행 지역 수]" >&2
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

OUT_ROOT=${KAKAO_MAP_DIR:-$ROOT/kakao-map}
# worktree 안 kakao-map/은 worktree를 정리할 때 함께 지워진다.
GIT_DIR=$(git -C "$ROOT" rev-parse --path-format=absolute --git-dir)
GIT_COMMON_DIR=$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir)
if [[ -z ${KAKAO_MAP_DIR:-} && $GIT_DIR != "$GIT_COMMON_DIR" ]]; then
  echo "worktree에서 실행 중입니다. 결과가 정리 때 지워지지 않도록 KAKAO_MAP_DIR=<메인 체크아웃>/kakao-map 을 주세요." >&2
  exit 2
fi

EX=
if [[ $MODE != cafe ]]; then
  # 서울 수집과 같은 제외 단어(기본값 + 간식)를 쓴다.
  EX_FILE="$OUT_ROOT/exclude-categories.txt"
  [[ -s $EX_FILE ]] || {
    echo "제외 카테고리 파일이 없습니다: $EX_FILE (서울 수집에 쓴 파일)" >&2
    exit 2
  }
  EX=$(tr -d '\r\n' <"$EX_FILE")
fi

LINES=$(grep -v -e '^#' -e '^[[:space:]]*$' "$LIST" | awk -F'\t' -v only="${ONLY:-}" 'only == "" || $1 ~ only')
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

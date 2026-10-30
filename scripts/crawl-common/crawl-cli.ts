// 크롤러 CLI 공용: `--name=value` 옵션 읽기·검증, 결과 파일 git ignore 확인.
import { spawnSync } from 'child_process';
import { dirname } from 'path';

export function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

/** 정수 옵션. [min, max] 밖이거나 정수가 아니면 오류. */
export function intArg(
  name: string,
  fallback: number,
  min: number,
  max = Infinity,
): number {
  const raw = arg(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    const range = max === Infinity ? `${min} 이상` : `${min}~${max}`;
    throw new Error(`--${name}는 ${range}의 정수여야 합니다: ${raw}`);
  }
  return value;
}

export function listArg(name: string, fallback: string[]): string[] {
  const raw = arg(name);
  if (raw === undefined) return fallback;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

/** 결과 파일이 git에 올라가지 않도록, 저장소 안이면 ignore 대상인지 확인한다. */
export function assertUntrackedOutput(path: string, example: string): void {
  const result = spawnSync('git', ['check-ignore', '-q', path], {
    cwd: dirname(path),
  });
  // 0: ignore 대상, 1: ignore 아님, 128: 저장소 밖(그 밖의 128·실행 실패는 거부)
  if (result.status === 0) return;
  const stderr = result.stderr?.toString() ?? '';
  if (result.status === 128 && /not a git repository/i.test(stderr)) return;
  if (result.status === 1) {
    throw new Error(
      `출력 경로가 git ignore 대상이 아닙니다: ${path}\n.gitignore된 경로(예: ${example})를 쓰세요.`,
    );
  }
  throw new Error(
    `출력 경로의 git ignore 여부를 확인하지 못했습니다(${result.error?.message ?? stderr.trim()}): ${path}`,
  );
}

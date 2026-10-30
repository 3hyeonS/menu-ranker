// 크롤러 공용 파일 유틸: CSV 값 이스케이프, 진행 상태 파일 읽기, 중단으로 잘린 CSV 정리.
import { existsSync, readFileSync, writeFileSync } from 'fs';

/** CSV 값 하나. 줄바꿈은 공백으로 바꿔 한 줄이 한 행이 되게 한다. */
export function csvField(value: string): string {
  const flat = value.replace(/[\r\n]+/g, ' ');
  return /[",]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat;
}

/** Excel에서 바로 열리도록 UTF-8(BOM) + CRLF 헤더 줄. */
export function csvHeaderLine(headers: readonly string[]): string {
  return `﻿${headers.join(',')}\r\n`;
}

/**
 * CSV가 없으면 헤더를 쓰고, 있으면 중단으로 잘린 마지막 줄만 지운다.
 * 행은 항상 줄바꿈으로 끝나므로, 파일이 줄바꿈으로 끝나지 않으면 마지막 줄이 덜 쓰인 것이다.
 * (다른 도구가 LF로 저장해도 지우지 않도록 `\n`으로 판단한다.)
 */
export function ensureCsv(path: string, headerLine: string): void {
  if (!existsSync(path)) {
    writeFileSync(path, headerLine, 'utf8');
    return;
  }
  const content = readFileSync(path, 'utf8');
  if (content.endsWith('\n')) return;
  const lastLineEnd = content.lastIndexOf('\n');
  // 줄바꿈이 하나도 없으면 헤더조차 덜 쓰인 것이므로 헤더를 다시 쓴다.
  writeFileSync(
    path,
    lastLineEnd < 0 ? headerLine : content.slice(0, lastLineEnd + 1),
    'utf8',
  );
}

/** 빈 줄을 뺀 줄 목록. 파일이 없으면 빈 배열. */
export function readLines(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
}

/** jsonl 각 줄을 파싱한다. 중단으로 덜 쓰인 줄은 건너뛴다. */
export function readJsonLines<T>(path: string): T[] {
  const values: T[] = [];
  for (const line of readLines(path)) {
    try {
      values.push(JSON.parse(line) as T);
    } catch {
      continue;
    }
  }
  return values;
}

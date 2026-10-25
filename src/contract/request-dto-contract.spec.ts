import { AppModule } from '../app.module';
import {
  collectControllers,
  collectRequestDtos,
  describeDto,
  expandNestedDtos,
} from './contract-metadata.helper-spec';

// 라우트의 @Body·@Query·@Param DTO(중첩 DTO 포함)의 필드·validation 데코레이터 스냅샷.
// 필드 추가·삭제, validator 변경은 요청 계약 변경이다. 의도한 변경일 때만 `-u`로 갱신한다.
describe('API request DTO contract', () => {
  const dtos = expandNestedDtos(
    collectRequestDtos(collectControllers(AppModule)),
  ).sort((a, b) => a.name.localeCompare(b.name));

  it('lists every request DTO', () => {
    expect(dtos.map((dto) => dto.name)).toMatchSnapshot();
  });

  it('has unique DTO class names', () => {
    const names = dtos.map((dto) => dto.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it.each(dtos.map((dto) => [dto.name, dto] as const))('%s', (_name, dto) => {
    expect(describeDto(dto)).toMatchSnapshot();
  });
});

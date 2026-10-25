import { AppModule } from '../app.module';
import {
  collectControllers,
  describeRoutes,
} from './contract-metadata.helper-spec';

// 프론트로 나가는 라우트 계약(메서드·경로·상태 코드·응답 메시지·guard·인자) 스냅샷.
// 스냅샷이 바뀌면 API 계약 변경을 의심한다. 의도한 변경일 때만 `-u`로 갱신하고 PR에 이유를 적는다.
describe('API route contract', () => {
  const controllers = collectControllers(AppModule);
  const routes = controllers.flatMap(describeRoutes);

  it('registers every controller', () => {
    expect(controllers.map((c) => c.name).sort()).toMatchSnapshot();
  });

  it('has no duplicate method + path', () => {
    const keys = routes.map((r) => `${r.method} ${r.path}`);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it.each(controllers.map((c) => [c.name, c] as const))(
    '%s routes',
    (_name, controller) => {
      const byRoute = Object.fromEntries(
        describeRoutes(controller)
          .sort((a, b) =>
            `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
          )
          .map(({ method, path, ...rest }) => [`${method} ${path}`, rest]),
      );
      expect(byRoute).toMatchSnapshot();
    },
  );
});

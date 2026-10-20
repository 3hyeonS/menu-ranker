# Repository guidelines

## Project overview

- This repository is a NestJS 10 backend written in TypeScript.
- MySQL/TypeORM is the primary application datastore. PostgreSQL with pgvector is an optional sidecar for menu embedding search.
- Feature code lives under `src/`; unit tests are colocated as `*.spec.ts`; end-to-end tests live under `test/`.
- Repository scripts for imports, benchmarks, vector indexing, and data preparation live under `scripts/` or the relevant feature directory.

## Working conventions

- Preserve the existing NestJS module/controller/service and DTO/entity organization.
- Follow the existing TypeScript style and Prettier settings: single quotes and trailing commas.
- Keep changes scoped to the request. Do not reformat or refactor unrelated files.
- Treat migrations, bulk imports, vector indexing, benchmark runs, and scripts that call external APIs as stateful operations. Do not run them without explicit user authorization and the required environment configuration.
- Never add credentials or secrets to source control. Use environment variables and document any newly required variables.
- When changing database entities or schemas, call out whether a TypeORM migration or pgvector schema update is required. Do not generate or run migrations unless requested.

## Verification

- Prefer the narrowest relevant test first: `npm test -- --runInBand <test-path-or-pattern>`.
- Run the full unit suite with `npm test -- --runInBand` when the change has broad impact.
- Run end-to-end tests with `npm run test:e2e` when HTTP behavior or application wiring changes and the required services are available.
- Run `npm run build` for TypeScript/NestJS compilation validation.
- The `npm run lint` script uses `--fix`; because it modifies files, run it only when formatting changes are acceptable, then inspect the diff.
- Report which checks were run and any checks skipped because services, credentials, or external dependencies were unavailable.

## Documentation and generated artifacts

- Keep operational and benchmark documentation under `docs/` aligned with related script or protocol changes.
- Do not commit generated output such as `dist/`, coverage data, benchmark results, or local caches unless the user explicitly requests it and the repository already tracks that artifact class.

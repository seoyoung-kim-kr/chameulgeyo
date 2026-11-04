# 참을게요

결제하기 전에 가격 하나를 넣으면, 다음 달 생활비가 어떻게 되는지 빨강/초록 신호등으로 보여주는 1인용 웹앱.

> 개발 중. 렌더링 전략, 계산식, 실측 결과는 1차 완료 후 정리한다.

## 로컬 실행

```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev
```

| 스크립트 | 내용 |
| --- | --- |
| `npm test` | vitest (`lib/**/*.test.ts`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | `db/schema.ts` 변경을 `drizzle/` 마이그레이션 SQL로 생성 |
| `npm run db:migrate` | 마이그레이션을 DB에 적용 |
| `npm run db:smoke` | DB 연결·트랜잭션 확인 |

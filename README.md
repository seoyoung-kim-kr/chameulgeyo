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
| `npm run db:migrate` | 마이그레이션을 DB에 적용 (이미 적용된 것은 건너뜀) |
| `npm run db:smoke` | DB 연결·트랜잭션 확인 |
| `npm run db:check-choose` | 같은 id 로 "그래도 산다"를 여러 번(순차·동시) 보내도 카드값이 한 번만 오르는지 확인. dev DB 전용, 끝나면 되돌림 |

## 배포 시 DB 마이그레이션

Vercel은 `build` 대신 `vercel-build`를 실행하고, 여기서 `db:migrate`를 먼저 돌린 뒤 `next build`를 한다.
Neon 연동이 미리보기 배포마다 기본 브랜치를 복사해 새 DB 브랜치를 만들기 때문에, 이 단계가 없으면 미리보기 DB에 테이블이 없어 홈이 500을 낸다.
`DATABASE_URL`이 없으면 빌드가 실패한다. `main`에 머지하면 production DB에도 같은 방식으로 적용된다.

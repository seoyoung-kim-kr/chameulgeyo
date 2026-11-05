// 로컬 확인용 세션 쿠키 값 출력 (구글 로그인 없이 화면을 보려고). 엔드포인트가 아니라 로컬에서만 실행한다.
// 실행: npm run dev:session -- <사용자 id>   (기본 1)
// 출력값을 브라우저의 cg_session 쿠키로 넣는다. SESSION_SECRET 은 dev 서버와 같아야 한다.
import { createSessionToken, getSessionSecret } from '../lib/session-token'

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('production 에서는 쓰지 않는다')
  const userId = Number(process.argv[2] ?? 1)
  console.log(await createSessionToken(getSessionSecret(), userId))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

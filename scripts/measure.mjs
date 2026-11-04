// 배포본 응답 시간 측정 (README 성능 실측 표용). 의존성 없음, Node 22+.
//
// 사용:
//   CG_SESSION=<브라우저 쿠키 cg_session 값> node scripts/measure.mjs https://<배포 주소>
//   쿠키는 로그인한 브라우저 개발자도구 → Application(애플리케이션) → Cookies 에서 복사한다.
//
// 콜드: 10분 이상 아무도 열지 않은 뒤 실행하면 첫 요청이 콜드 스타트다 (함수 + Neon 깨우기).
// 웜: 이어지는 요청들. 각 경로를 RUNS 번 재고 중앙값을 낸다.
// TTFB = 응답 헤더가 올 때까지, 완료 = 스트리밍된 본문(숫자 포함)을 다 받을 때까지.

const RUNS = Number(process.env.RUNS ?? 10)
const PATHS = ['/', '/check']

const base = process.argv[2]?.replace(/\/$/, '')
const session = process.env.CG_SESSION
if (!base || !session) {
  console.error('사용: CG_SESSION=<쿠키값> node scripts/measure.mjs https://<배포 주소>')
  process.exit(1)
}

async function once(path) {
  const t0 = performance.now()
  const res = await fetch(base + path, { headers: { cookie: `cg_session=${session}` }, redirect: 'manual' })
  const ttfb = performance.now() - t0
  await res.arrayBuffer()
  const total = performance.now() - t0
  if (res.status !== 200) throw new Error(`${path} → HTTP ${res.status} (쿠키가 만료됐거나 배포 보호가 켜져 있는지 확인)`)
  return { ttfb, total }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const ms = (n) => `${Math.round(n)}ms`

const first = await once('/')
console.log(`첫 요청 (10분 이상 쉬었다면 콜드) /  TTFB ${ms(first.ttfb)}  완료 ${ms(first.total)}`)

for (const path of PATHS) {
  const runs = []
  for (let i = 0; i < RUNS; i++) runs.push(await once(path))
  console.log(
    `웜 ${path.padEnd(7)} ${RUNS}회 중앙값  TTFB ${ms(median(runs.map((r) => r.ttfb)))}  완료 ${ms(median(runs.map((r) => r.total)))}`,
  )
}

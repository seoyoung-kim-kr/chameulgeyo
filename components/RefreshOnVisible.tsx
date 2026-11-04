'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

/** 숨겨졌다가 다시 보이기까지 이 시간 미만이면 새로고침하지 않는다 (앱 전환 직후 중복 요청 방지) */
const MIN_HIDDEN_MS = 30_000

/**
 * 화면이 "다시 보일 때" 서버 컴포넌트를 다시 받는다. (app) 레이아웃에 한 번만 둔다.
 * 1. 탭·PWA 가 백그라운드에서 돌아올 때 — iOS PWA 는 복귀 시 마지막 화면을 그대로 보여주므로,
 *    다른 기기에서 바꾼 카드값이 이것 없이는 반영되지 않는다.
 * 2. 뒤로/앞으로 가기(스와이프 백 포함) — Link·router.push 이동은 Next 가 데이터를 다시 받지만,
 *    뒤로 가기는 Activity 가 보존한 화면을 그대로 복원해 숫자가 오래된 채 남는다 (Task 7 Step 7 실측).
 *    돌아온 경로를 새로 받아야 하므로 라우터가 경로를 바꾼 뒤에 refresh 한다. Next 는 popstate 를 동기 처리해
 *    보통 이 컴포넌트의 리스너보다 먼저 경로가 바뀌어 있지만(실측), 순서가 반대인 경우도 플래그로 받는다.
 */
export function RefreshOnVisible() {
  const router = useRouter()
  const pathname = usePathname()
  const poppedRef = useRef(false)
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    let hiddenAt: number | null = null
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= MIN_HIDDEN_MS) router.refresh()
      hiddenAt = null
    }
    const onPop = () => {
      if (pathnameRef.current === window.location.pathname) {
        router.refresh()
        return
      }
      poppedRef.current = true
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('popstate', onPop)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('popstate', onPop)
    }
  }, [router])

  useEffect(() => {
    pathnameRef.current = pathname
    if (!poppedRef.current) return
    poppedRef.current = false
    router.refresh()
  }, [pathname, router])

  return null
}

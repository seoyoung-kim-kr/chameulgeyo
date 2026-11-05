'use client'

import { useSearchParams } from 'next/navigation'

/** 구글 로그인 콜백이 실패하면 /login?error=1 로 돌아온다. 원인은 나누지 않는다 (서버 로그에만) */
export function LoginError() {
  const failed = useSearchParams().get('error') !== null
  return (
    <p aria-live="polite" className="min-h-10 text-center text-sm text-red">
      {failed && (
        <>
          로그인하지 못했어요.
          <br />
          다시 시도해 주세요.
        </>
      )}
    </p>
  )
}

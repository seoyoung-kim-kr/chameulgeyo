import { Suspense } from 'react'
import { SetupLoader, SetupSkeleton } from './SetupLoader'

// 정적 셸 + 스트리밍. 세션·DB 는 <Suspense> 안의 SetupLoader 에서만 읽는다.
export default function SetupPage() {
  return (
    <Suspense fallback={<SetupSkeleton />}>
      <SetupLoader />
    </Suspense>
  )
}

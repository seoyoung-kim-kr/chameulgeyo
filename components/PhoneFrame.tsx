import type { ReactNode } from 'react'
import { Lace } from './Lace'

/**
 * 모바일: 화면을 꽉 채우고 문서 전체가 스크롤된다.
 * md(768px) 이상: 연핑크 배경 가운데 430px 흰 프레임. 프레임 높이는 844px 이되 창이 더 낮으면
 * 창 높이에 맞춰 줄고(노트북에서 아래가 잘리지 않게), 프레임 안쪽만 스크롤된다. 레이스는 스크롤해도 맨 위에 남는다.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:flex md:h-dvh md:items-center md:justify-center md:p-6">
      <div className="flex min-h-dvh flex-col md:relative md:h-full md:max-h-[844px] md:min-h-0 md:w-[430px] md:overflow-hidden md:rounded-[40px] md:bg-white md:shadow-[0_18px_50px_rgba(201,56,107,.14)]">
        <Lace />
        <div className="flex flex-1 flex-col md:min-h-0 md:overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

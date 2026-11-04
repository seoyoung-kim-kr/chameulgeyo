import clsx from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

/*
 * 화면 레이아웃 규칙 (4px 단위). 화면마다 여백을 따로 쓰지 말고 이 컴포넌트들을 쓴다.
 *   화면 여백      좌우 20 · 위 20 · 아래 32
 *   제목 줄        높이 32, 본문까지 24
 *   본문           카드 사이 12, 카드 안쪽 16
 *   라벨 → 값      8
 *   하단 버튼      본문과 최소 24, 버튼 사이 8 (주 버튼 56, 보조 버튼 44)
 *   입력칸         높이 48
 *   글자           제목 xl/bold · 라벨 sm/muted · 카드 금액 lg/bold · 큰 금액 3xl/bold
 */

type ScreenProps = {
  title: ReactNode
  /** 제목 옆 보조 정보 (주기 날짜 등) */
  sub?: ReactNode
  /** 제목 줄 오른쪽 (닫기, 칩) */
  action?: ReactNode
  children: ReactNode
}

/** 한 화면. 본문은 세로로 쌓이고(간격 12), 남는 공간은 아래 버튼 영역이 가져간다. */
export function Screen({ title, sub, action, children }: ScreenProps) {
  return (
    <main className="flex flex-1 flex-col px-5 pt-5 pb-8">
      <header className="mb-6 flex h-8 items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-baseline gap-2 text-xl font-bold">
          <span className="truncate">{title}</span>
          {sub && <span className="shrink-0 text-sm font-normal text-muted">{sub}</span>}
        </h1>
        {action}
      </header>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
    </main>
  )
}

/** 화면 맨 아래 버튼 영역. 본문이 짧으면 바닥에 붙고, 길면 본문 뒤로 24 띄워 온다. */
export function BottomActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('mt-auto flex flex-col items-stretch gap-2 pt-3', className)}>{children}</div>
}

/** 흰 카드 (안쪽 16). tint 는 강조 배경. */
export function Card({ children, tone = 'white', className, ...rest }: { children: ReactNode; tone?: 'white' | 'tint' | 'green'; className?: string } & HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={clsx(
        'rounded-card p-4',
        tone === 'white' && 'border border-line bg-white',
        tone === 'tint' && 'bg-tint',
        tone === 'green' && 'bg-green-soft',
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  )
}

/** 오류·경고 한 줄 자리. 비어 있어도 높이를 차지해 버튼이 들썩이지 않는다. */
export function Message({ children, tone = 'red' }: { children?: ReactNode; tone?: 'red' | 'muted' }) {
  return (
    <p aria-live="polite" className={clsx('min-h-5 text-center text-sm', tone === 'red' ? 'text-red' : 'text-muted')}>
      {children}
    </p>
  )
}

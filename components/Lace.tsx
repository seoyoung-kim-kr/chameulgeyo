const LACE_STYLE = {
  // 위: 2px 띠 / 아래: 띠에 매달린 반원 (지름 12, 16px 간격)
  backgroundImage:
    'linear-gradient(var(--color-line), var(--color-line)), radial-gradient(circle at 8px 2px, var(--color-line) 6px, transparent 6.5px)',
  backgroundSize: '100% 2px, 16px 10px',
  backgroundRepeat: 'no-repeat, repeat-x',
} as const

/**
 * 화면 맨 위 레이스 한 줄. 위쪽 가장자리에 붙은 띠에서 반원이 아래로 늘어진다.
 * 장식 규칙상 이것 외의 레이스는 쓰지 않는다. PhoneFrame 이 한 번만 그린다.
 */
export function Lace() {
  // 데스크톱 프레임은 모서리가 둥글어(40px) 양 끝 반원이 잘리므로 곡선 안쪽에서 시작한다
  return <div aria-hidden className="h-2.5 shrink-0 md:mx-8" style={LACE_STYLE} />
}

/** 화면 최상단 한 줄 레이스 장식. 장식 규칙상 이것 외의 레이스는 쓰지 않는다. */
export function Lace() {
  return (
    <div
      aria-hidden
      className="h-3 w-full bg-[radial-gradient(circle_at_8px_12px,var(--color-line)_6px,transparent_7px)] bg-[length:16px_12px] bg-repeat-x"
    />
  );
}

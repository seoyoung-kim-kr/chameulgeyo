const won = new Intl.NumberFormat('ko-KR')

/** 원 단위 정수를 천 단위 콤마로. 음수는 하이픈이 아닌 U+2212(−)를 쓴다. */
export function formatWon(n: number): string {
  if (n < 0) return '−' + won.format(Math.abs(n))
  return won.format(n)
}

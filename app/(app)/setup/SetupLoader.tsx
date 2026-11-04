import { getSetupDefaults, type CardBillRow, type MonthRow, type Settings } from '@/lib/queries'
import type { SaveMonthInput } from '@/lib/validation'
import { SetupWizard } from './SetupWizard'

// /setup 과, 이번 주기 설정이 없을 때의 홈(/)이 함께 쓴다. 세션·DB 를 읽으므로 <Suspense> 안에 둔다.
export async function SetupLoader() {
  const { settings, today, current, previous, thisBill, nextBill, reserves } = await getSetupDefaults()
  const defaults = toDefaults(settings, current, previous, thisBill, nextBill)
  // 저장 후 서버 값이 바뀌면 마법사를 새로 마운트해 입력 상태를 서버 값과 맞춘다
  return (
    <SetupWizard
      key={JSON.stringify(defaults)}
      defaults={defaults}
      today={today}
      thisBillDue={thisBill?.dueDate ?? null}
      nextBillDue={nextBill?.dueDate ?? null}
      reserves={reserves}
      isFirst={!current && !previous}
    />
  )
}

function toDefaults(
  settings: Settings,
  current: MonthRow | null,
  previous: MonthRow | null,
  thisBill: CardBillRow | null,
  nextBill: CardBillRow | null,
): SaveMonthInput {
  const base = current ?? previous
  return {
    payDay: settings.payDay,
    cardCutoffDay: settings.cardCutoffDay,
    cardPayDay: settings.cardPayDay,
    salary: base?.salary ?? 0,
    // 카드 대금은 출금일 기준이라, 지난 주기에 적은 "다음 대금"이 이번 주기 대금으로 그대로 채워진다
    thisBill: thisBill?.amount ?? 0,
    nextBill: nextBill?.amount ?? 0,
    livingTarget: base?.livingTarget ?? 0,
    emergencyAmount: base?.emergencyAmount ?? 0,
    // 결제 수단이 없는 기존 항목은 미분류(null) 그대로 둔다. 임의로 카드로 보지 않는다
    fixed: (base?.fixed ?? []).map((f) => ({ name: f.name, amount: f.amount, method: f.paymentMethod })),
  }
}

export function SetupSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-5 pt-5 pb-8" aria-busy>
      <div className="mb-3 h-8 w-40 rounded-full bg-soft" />
      <div className="h-28 rounded-card bg-white" />
      <div className="h-56 rounded-card bg-white" />
      <div className="h-28 rounded-card bg-white" />
    </div>
  )
}

import { Suspense } from 'react'
import { getSetupDefaults, type MonthRow } from '@/lib/queries'
import type { SaveMonthInput } from '@/lib/validation'
import { SetupWizard } from './SetupWizard'

// 정적 셸 + 스트리밍. 세션·DB 는 <Suspense> 안의 SetupLoader 에서만 읽는다.
export default function SetupPage() {
  return (
    <Suspense fallback={<SetupSkeleton />}>
      <SetupLoader />
    </Suspense>
  )
}

async function SetupLoader() {
  const { settings, today, current, previous } = await getSetupDefaults()
  const defaults = toDefaults(settings, current, previous)
  // 저장 후 서버 값이 바뀌면 마법사를 새로 마운트해 입력 상태를 서버 값과 맞춘다
  return <SetupWizard key={JSON.stringify(defaults)} defaults={defaults} today={today} isFirst={!current && !previous} />
}

function toDefaults(settings: { payDay: number; cardCutoffDay: number }, current: MonthRow | null, previous: MonthRow | null): SaveMonthInput {
  const base = current ?? previous
  return {
    payDay: settings.payDay,
    cardCutoffDay: settings.cardCutoffDay,
    salary: base?.salary ?? 0,
    // 새 주기는 카드값을 비워서 새로 입력받는다
    cardBalance: current?.cardBalance ?? 0,
    livingTarget: base?.livingTarget ?? 0,
    emergencyAmount: base?.emergencyAmount ?? 0,
    fixed: (base?.fixed ?? []).map((f) => ({ name: f.name, amount: f.amount })),
  }
}

function SetupSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-5 pt-5" aria-busy>
      <div className="mb-2 h-7 w-40 rounded-full bg-soft" />
      <div className="h-20 rounded-card bg-white" />
      <div className="h-56 rounded-card bg-white" />
      <div className="h-20 rounded-card bg-white" />
    </div>
  )
}

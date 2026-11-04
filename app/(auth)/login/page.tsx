import { PhoneFrame } from '@/components/PhoneFrame'
import { PinPad } from './PinPad'

export default function LoginPage() {
  return (
    <PhoneFrame>
      <main className="flex flex-1 flex-col items-center px-5 pt-16 pb-8">
        <h1 className="text-2xl font-bold text-deep">♡ 소비신호등</h1>
        <p className="mt-2 mb-10 text-sm text-muted">비밀번호 6자리를 입력해 주세요.</p>
        <PinPad />
      </main>
    </PhoneFrame>
  )
}

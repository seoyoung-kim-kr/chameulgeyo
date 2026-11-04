import { Lace } from '@/components/Lace'
import { PhoneFrame } from '@/components/PhoneFrame'
import { PinPad } from './PinPad'

export default function LoginPage() {
  return (
    <PhoneFrame>
      <Lace />
      <main className="flex flex-col items-center px-6 pt-20 pb-10">
        <h1 className="text-2xl font-bold text-deep">♡ 참을게요</h1>
        <p className="mt-2 mb-12 text-muted">PIN 을 입력해 주세요</p>
        <PinPad />
      </main>
    </PhoneFrame>
  )
}

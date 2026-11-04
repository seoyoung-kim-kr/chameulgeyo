'use client'

import clsx from 'clsx'
import { useState, useTransition } from 'react'
import { Keypad } from '@/components/Keypad'
import { PIN_LENGTH } from '@/lib/pin'
import { login } from './actions'

export function PinPad() {
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(0)
  const [pending, startTransition] = useTransition()

  const onChange = (next: string) => {
    setPin(next)
    if (next.length !== PIN_LENGTH) return
    startTransition(async () => {
      const result = await login(next)
      // 성공하면 서버에서 redirect 되므로 여기까지 오는 건 실패뿐이다
      if (!result.ok) {
        setWrong((n) => n + 1)
        setPin('')
      }
    })
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div
        key={wrong}
        className={clsx('flex gap-4', wrong > 0 && 'animate-shake motion-reduce:animate-none')}
        aria-label={`비밀번호 ${pin.length}자리 입력됨`}
        role="status"
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={clsx('size-4 rounded-full border-2 border-pink', i < pin.length ? 'bg-pink' : 'bg-transparent')}
          />
        ))}
      </div>
      <p className="min-h-5 text-sm text-red" aria-live="polite">
        {wrong > 0 && !pending ? '비밀번호가 맞지 않아요.' : ''}
      </p>
      <div className="w-full max-w-72">
        <Keypad value={pin} onChange={onChange} maxLength={PIN_LENGTH} kind="code" disabled={pending} />
      </div>
    </div>
  )
}

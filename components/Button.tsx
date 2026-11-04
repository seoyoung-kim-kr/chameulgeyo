import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'soft' | 'text' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'h-14 w-full rounded-full bg-linear-to-r from-[#FF8DB0] to-pink text-lg font-bold text-white shadow-[0_8px_20px_rgba(240,98,143,.3)] active:to-deep',
  soft: 'h-14 w-full rounded-full border border-line bg-white text-lg font-bold text-deep active:bg-soft',
  text: 'h-11 px-4 text-base text-muted active:text-ink',
  danger: 'h-11 px-4 text-base text-red',
}

/** <Link> 같은 다른 요소에 버튼 모양을 입힐 때 */
export function buttonClass(variant: Variant = 'primary', className?: string): string {
  return clsx(VARIANTS[variant], 'inline-flex items-center justify-center', className)
}

export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={clsx(VARIANTS[variant], 'disabled:opacity-40', className)} {...rest} />
}

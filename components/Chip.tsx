import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'solid' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  solid: 'bg-soft text-deep',
  ghost: 'border border-line bg-white text-muted',
}

const base = 'inline-flex h-7 items-center rounded-full px-3 text-xs'

/** onClick 이 있으면 버튼, 없으면 표시용 span */
export function Chip({
  variant = 'ghost',
  className,
  children,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  if (!onClick) return <span className={clsx(base, VARIANTS[variant], className)}>{children}</span>
  return (
    <button type="button" onClick={onClick} className={clsx(base, VARIANTS[variant], 'active:opacity-70', className)} {...rest}>
      {children}
    </button>
  )
}

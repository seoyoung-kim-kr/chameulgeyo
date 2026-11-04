'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

const SHOW_MS = 2500

const ToastContext = createContext<(text: string) => void>(() => {})

/** 화면을 옮겨도 남는 한 줄 알림. 판정 후 홈으로 돌아가면서 "N원 지켰어요 ♡" 를 띄운다. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)
  const show = useCallback((text: string) => setToast({ text, key: Date.now() }), [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), SHOW_MS)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-30 flex justify-center px-5">
        {toast && (
          <p key={toast.key} className="animate-toast rounded-full bg-ink/90 px-5 py-3 text-sm text-white shadow-lg motion-reduce:animate-none">
            {toast.text}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

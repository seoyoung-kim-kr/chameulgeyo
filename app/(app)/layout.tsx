import { PhoneFrame } from '@/components/PhoneFrame'
import { RefreshOnVisible } from '@/components/RefreshOnVisible'
import { ToastProvider } from '@/components/Toast'

// 세션을 읽지 않는 정적 셸. 세션·데이터를 읽는 부분은 각 page 의 <Suspense> 안에 둔다.
// (Cache Components 에서 layout 최상단 await 는 아래 화면 전체를 막는다)
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <PhoneFrame>
      <ToastProvider>
        <RefreshOnVisible />
        {children}
      </ToastProvider>
    </PhoneFrame>
  )
}

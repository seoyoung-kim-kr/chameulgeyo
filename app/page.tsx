import { Lace } from "@/components/Lace";
import { PhoneFrame } from "@/components/PhoneFrame";

// 임시 홈. Task 5 에서 (app) 그룹으로 옮기고 Task 7 에서 실제 홈으로 바꾼다.
export default function Home() {
  return (
    <PhoneFrame>
      <Lace />
      <main className="px-6 py-10">
        <h1 className="text-2xl font-bold text-deep">♡ 참을게요</h1>
        <p className="mt-3 text-muted">준비 중이에요.</p>
        <p className="font-gungsuh mt-8 text-xl">지금은 사면 안 된다.</p>
      </main>
    </PhoneFrame>
  );
}

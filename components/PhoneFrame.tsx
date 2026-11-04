import type { ReactNode } from "react";

/** 모바일에선 그대로, md(768px) 이상에선 연핑크 배경 가운데 430px 흰 프레임에 담는다. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:flex md:items-center md:justify-center md:py-10">
      <div className="min-h-dvh md:relative md:min-h-[844px] md:w-[430px] md:overflow-hidden md:rounded-[40px] md:bg-white md:shadow-[0_18px_50px_rgba(201,56,107,.14)]">
        {children}
      </div>
    </div>
  );
}

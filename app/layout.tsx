import type { Metadata, Viewport } from "next";
import { Nanum_Myeongjo, Sunflower } from "next/font/google";
import "./globals.css";

// Sunflower 는 Google Fonts 에 subset 정보가 없어 preload 대상이 아니다 (한글은 unicode-range 로 나눠 받음).
const sunflower = Sunflower({
  weight: ["300", "500", "700"],
  variable: "--font-sunflower",
  display: "swap",
});

// 궁서 대체. 빨간 판정 화면의 세 줄에만 쓰므로 preload 하지 않는다.
const nanumMyeongjo = Nanum_Myeongjo({
  weight: "800",
  variable: "--font-nanum-myeongjo",
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "참을게요",
  description: "결제하기 전에 한 번 더, 다음 달 생활비를 보여주는 신호등",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "참을게요" },
};

export const viewport: Viewport = {
  themeColor: "#FFF5F8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${sunflower.variable} ${nanumMyeongjo.variable} antialiased`}
    >
      <body className="font-ui bg-bg text-ink">{children}</body>
    </html>
  );
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "참을게요",
    short_name: "참을게요",
    description: "결제하기 전에 한 번 더, 다음 달 생활비를 보여주는 신호등",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF5F8",
    theme_color: "#FFF5F8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

import type { NextConfig } from "next";

// GitHub Pages proje sayfası /<repo>/ alt yolundan sunulur → o build için
// NEXT_PUBLIC_BASE_PATH=/dzimem verilir. APK/Capacitor build'inde bu env YOK
// → basePath boş kalır (kök yoldan sunulur). Böylece tek config iki hedefe uyar.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
};

export default nextConfig;

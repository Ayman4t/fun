import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["600", "900"], display: "swap" });

const title = "شد الحبل القومي";
const description = "الشتا ولا الصيف؟ اضغط وشد الحبل مع آلاف اللاعبين دلوقتي.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, locale: "ar_EG", type: "website" },
};

// no pinch-zoom, edge-to-edge on notched phones
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.className} overscroll-none bg-slate-950`}>{children}</body>
    </html>
  );
}

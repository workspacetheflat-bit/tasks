import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "يومي | متابعة المهام والمكافأة",
  description: "لوحة خاصة لمتابعة المهام اليومية والخصومات والمكافأة الشهرية.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

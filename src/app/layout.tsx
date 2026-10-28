import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "بانک اطلاعات شرکت‌ها و کارخانه‌های ایران",
  description:
    "پنل مدیریت سامانه هوشمند شناسایی شرکت‌ها و کارخانه‌های ایران — مدیریت اجراهای کشف، بازبینی داده‌ها و خروجی اکسل",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster richColors position="bottom-left" dir="rtl" closeButton />
      </body>
    </html>
  );
}

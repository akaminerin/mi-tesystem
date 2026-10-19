import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "進む君｜定例会議AIエージェント",
  description: "話すだけで会議のやるべきことが見えて動き出す、頼れる定例会議パートナー。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}


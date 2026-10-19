Attempting to perform the InitializeDefaultDrives operation on the 'FileSystem' provider failed.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ミーテ｜定例会議AIエージェント",
  description: "会議を見て、進捗を見て、次の一歩まで支える定例会議AIエージェント。",
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


import type { Metadata } from "next";

import { appUrl } from "@/lib/env";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Merriva — Undangan Digital",
    template: "%s · Merriva",
  },
  description:
    "Platform undangan digital self-service untuk pernikahan, corporate, dan acara keluarga.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

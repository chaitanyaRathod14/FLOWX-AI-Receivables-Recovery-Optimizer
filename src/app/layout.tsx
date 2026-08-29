import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FLOWX | Receivables operating system",
  description: "AI-assisted receivables recovery with deterministic financial controls.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

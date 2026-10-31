import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vendrith Chat",
  description: "Player conversations for the World of Vendrith universe."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
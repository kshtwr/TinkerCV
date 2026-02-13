import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "To my gorgeous girlfriend",
  description: "I have a special question for my special ladyyy..."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}



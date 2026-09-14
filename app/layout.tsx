import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fenderly — AI Vehicle Damage Assessment",
  description:
    "Upload a photo of a damaged vehicle and get make, model, color, a damage summary, and a repair cost estimate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

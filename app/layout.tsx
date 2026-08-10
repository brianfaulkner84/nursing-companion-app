import { Oswald, Inter } from "next/font/google";
import SiteHeader from "@/components/site-header";
import "./globals.css";

const heading = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });

export const metadata = {
  title: "LPN Launchpad",
  description: "NCLEX-PN practice question companion",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>
        <SiteHeader />
        <div className="page">{children}</div>
      </body>
    </html>
  );
}

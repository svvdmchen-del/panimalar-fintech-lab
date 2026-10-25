import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panimalar MBA Fintech Lab Terminal — NSE India market dashboard",
  description:
    "Classroom dashboard for NSE India market data: live index cards, ticker tape, watchlist, charts, sector heat-map, FII/DII flows, option chain and market news.",
};

export const viewport: Viewport = {
  themeColor: "#05070b",
  // "light dark" lets the CSS color-scheme on :root decide; the theme is manual.
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script
          // Runs before paint: applies the saved theme so a reload never flashes dark.
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("nse-lab.theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}addEventListener("DOMContentLoaded",function(){var m=document.querySelector(\'meta[name="theme-color"]\');if(m){m.setAttribute("content",t==="light"?"#eef2f8":"#05070b");}});}catch(e){}',
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

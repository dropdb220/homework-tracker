import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { Lilita_One } from "next/font/google";

import Header from "./header";

import "./globals.css";

const Pretendard = localFont({
  src: '../public/PretendardVariable.woff2',
  weight: "45 920",
  display: "swap"
});

const LilitaOne = Lilita_One({
  weight: "400",
  display: "swap",
  subsets: ["latin"]
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      default: process.env.NEXT_PUBLIC_TITLE || '숙제 트래커',
      template: `${process.env.NEXT_PUBLIC_TITLE || '숙제 트래커'} - %s`
    },
    description: process.env.NEXT_PUBLIC_TITLE || '숙제 트래커',
    metadataBase: new URL(process.env.NEXT_PUBLIC_URL!),
    robots: { index: false, follow: false },
    twitter: {
      title: process.env.NEXT_PUBLIC_TITLE || '숙제 트래커',
      description: process.env.NEXT_PUBLIC_TITLE || '숙제 트래커'
    },
    openGraph: {
      title: process.env.NEXT_PUBLIC_TITLE || '숙제 트래커',
      description: process.env.NEXT_PUBLIC_TITLE || '숙제 트래커',
      type: 'website',
      url: `${process.env.NEXT_PUBLIC_URL!}`,
      siteName: process.env.NEXT_PUBLIC_TITLE || '숙제 트래커',
      locale: 'ko_KR'
    },
    alternates: {
      canonical: '/'
    }
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#333333' },
    { media: '(prefers-color-scheme: light)', color: 'white' },
  ]
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={/* Pretendard.className*/ LilitaOne.className}>
      <body>
        <Header />
        <main className="w-[90%] mt-4 ml-auto mr-auto">
          {children}
        </main>
        <div className="w-full mt-8 mb-8">
          <Link href="https://github.com/dropdb220/homework-tracker" rel="noopener noreferrer" target="_blank">
            <Image src="/github.svg" alt="소스코드 보기" width={24} height={24} className="kor dark:invert opacity-40 ml-auto mr-auto" />
            <Image src="/github.svg" alt="View Source" width={24} height={24} className="eng dark:invert opacity-40 ml-auto mr-auto" />
          </Link>
        </div>
      </body>
    </html>
  )
}

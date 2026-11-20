import { Geist, Geist_Mono } from "next/font/google"

/** Una sola familia sans (UI v2, docs/DESIGN-PATTERNS.md): sin remates. */
export const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
export const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

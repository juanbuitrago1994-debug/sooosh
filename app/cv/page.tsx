import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { ProfileGate } from "@/components/auth/profile-gate"
import { StickyHeader } from "@/components/common/sticky-header"
import { YourResume } from "@/components/cv/your-resume"
import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = { title: "Your resume · Sooosh", robots: { index: false, follow: false } }

export default function CvPage() {
  return (
    <ProfileGate>
      <div className="flex min-h-dvh w-full flex-col">
        <StickyHeader>
          <div className="mx-auto flex w-full max-w-4xl items-center gap-1 px-4 py-3 sm:px-6">
            <Link href="/" aria-label="Volver" className={buttonVariants({ variant: "ghost", size: "icon" })}>
              <ArrowLeftIcon aria-hidden />
            </Link>
            <p className="px-1 text-sm font-medium">Your resume</p>
          </div>
        </StickyHeader>
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pt-4 pb-12 sm:px-6">
          <YourResume />
        </main>
      </div>
    </ProfileGate>
  )
}

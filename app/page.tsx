import { ProfileGate } from "@/components/auth/profile-gate"
import { Wizard } from "@/components/wizard/wizard"

export default function Home() {
  return (
    <ProfileGate>
      <Wizard />
    </ProfileGate>
  )
}

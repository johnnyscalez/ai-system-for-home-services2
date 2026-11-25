import type { Metadata } from "next"
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard"

export const metadata: Metadata = { title: "Set up your account | FieldBuilt AI" }

// The layout already sends finished accounts to the dashboard and signed-out
// visitors to the login page, so this page only ever renders the wizard.
export default function OnboardingPage() {
  return <OnboardingWizard mode="onboarding" />
}

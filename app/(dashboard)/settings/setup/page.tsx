import type { Metadata } from "next"
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard"

export const metadata: Metadata = { title: "Account setup | FieldBuilt AI" }

// Everything collected at onboarding, editable after launch. Saving a section
// recompiles the live config (service area, qualifying rules, offer, measure
// calendar) through lib/intake-apply.ts.
export default function AccountSetupPage() {
  return <OnboardingWizard mode="edit" />
}

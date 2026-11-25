import { redirect } from "next/navigation"

// The wizard moved to /connect/facebook so it also works during onboarding
// (this route sits inside the dashboard layout, which an account that is still
// onboarding cannot enter). Old links and bookmarks land here and are forwarded.
export default function FacebookSetupRedirect() {
  redirect("/connect/facebook?return_to=integrations")
}

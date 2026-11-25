import type { CompanyIntake } from "@/lib/intake"
import type { StepId } from "./constants"
import type { WizardContext, WizardData } from "./logic"

export type WizardMode = "onboarding" | "edit"

/** What every step receives from the wizard shell. */
export type StepProps = {
  data: WizardData
  ctx: WizardContext
  mode: WizardMode
  /** Change anything in the wizard data. */
  update: (fn: (d: WizardData) => WizardData) => void
  /** Shorthand for replacing whole intake sections. */
  setIntake: (patch: Partial<CompanyIntake>) => void
  setCtx: (patch: Partial<WizardContext>) => void
  /** Saves now and resolves true when the server has it. */
  save: () => Promise<boolean>
  /**
   * Runs a server write after any save already in flight. Saves, uploads and
   * the number reservation all rewrite the same stored document, so they must
   * never overlap.
   */
  enqueue: <T>(fn: () => Promise<T>) => Promise<T>
  goTo: (step: StepId) => void
}

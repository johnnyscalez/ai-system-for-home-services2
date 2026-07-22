"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronRight } from "lucide-react"
import type { ServiceType } from "@/types/database"

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
]

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: "roofing", label: "Roofing" },
  { value: "solar", label: "Solar" },
  { value: "hvac", label: "HVAC" },
  { value: "windows", label: "Windows & Doors" },
  { value: "bath_remodel", label: "Bath Remodel" },
]

export type BusinessData = {
  companyName: string
  serviceType: ServiceType | ""
  state: string
  officeAddress: string
  serviceRadius: string
  notificationPhone: string
  country: string
}

interface Props {
  data: BusinessData
  onChange: (d: BusinessData) => void
  onNext: () => void
  onBack: () => void
  error?: string
}

export function StepBusiness({ data, onChange, onNext, onBack, error }: Props) {
  function set(field: keyof BusinessData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...data, [field]: e.target.value })
  }

  // Office address must include a 5-digit zip — the backend resolves the
  // service area (all zips within the radius) from that zip's centroid.
  const addressHasZip = /\b\d{5}\b/.test(data.officeAddress)
  const radiusOk = Number(data.serviceRadius) > 0
  const canProceed = !!data.companyName && !!data.serviceType && !!data.state && addressHasZip && radiusOk


  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Tell us about your business</h1>
      <p className="text-muted-foreground mb-8">
        This powers your AI — the more we know, the better it performs.
      </p>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Company name</Label>
          <Input
            id="companyName"
            placeholder="Apex Roofing"
            value={data.companyName}
            onChange={set("companyName")}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label>What service do you offer?</Label>
          <Select
            value={data.serviceType}
            onValueChange={(v) => onChange({ ...data, serviceType: v as ServiceType })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your primary service" />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>State</Label>
          <Select
            value={data.state}
            onValueChange={(v) => onChange({ ...data, state: v ?? "" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Used to assign you a local phone number in your state.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="officeAddress">Office address</Label>
          <Input
            id="officeAddress"
            placeholder="4501 Main St, Dallas, TX 75201"
            value={data.officeAddress}
            onChange={set("officeAddress")}
          />
          <p className="text-xs text-muted-foreground">
            Include the zip code — your service area is measured from here.
            {data.officeAddress && !addressHasZip && (
              <span className="text-destructive"> Add the 5-digit zip code.</span>
            )}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="serviceRadius">How far out do you serve? (miles)</Label>
          <Input
            id="serviceRadius"
            type="number"
            min={1}
            max={200}
            placeholder="25"
            value={data.serviceRadius}
            onChange={set("serviceRadius")}
          />
          <p className="text-xs text-muted-foreground">
            We map every zip code within this radius of your office — the AI books jobs inside it and politely turns down leads outside it.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notificationPhone">Appointment notification number <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="notificationPhone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={data.notificationPhone}
            onChange={set("notificationPhone")}
          />
          <p className="text-xs text-muted-foreground">
            We&apos;ll text this number the moment your AI books an appointment. You can add it later in Settings.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={onNext} disabled={!canProceed} className="gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

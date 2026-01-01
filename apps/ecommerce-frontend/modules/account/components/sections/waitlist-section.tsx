"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { SectionHeading } from "@/components/shared/section-heading"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { type WaitlistInsights } from "@/modules/account/server/query/service/waitlist-service"

import { joinWaitlistAction } from "../../server/mutation/join-waitlist"
import { waitlistSubmissionSchema } from "../../server/query/dto/waitlist-dto"

const waitlistFormSchema = waitlistSubmissionSchema.extend({
  notes: z.string().max(240).optional(),
})

type WaitlistFormValues = z.infer<typeof waitlistFormSchema>

const intents = [
  { value: "retail", label: "Retail fleet refresh" },
  { value: "hospitality", label: "Hospitality opening" },
  { value: "workspace", label: "Workspace retrofit" },
  { value: "hybrid", label: "Hybrid use case" },
]

type WaitlistSectionProps = {
  insights: WaitlistInsights
}

export function WaitlistSection({ insights }: WaitlistSectionProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")

  const form = useForm<WaitlistFormValues>({
    // hookform resolver typings still reference Zod v3, so we coerce here while using Zod v4 runtime.
    resolver: zodResolver(waitlistFormSchema as never),
    defaultValues: { intent: "retail", email: "", company: "", notes: "" },
  })

  const onSubmit = (values: WaitlistFormValues) => {
    startTransition(async () => {
      try {
        await joinWaitlistAction(values)
        form.reset({ intent: "retail", email: "", company: "", notes: "" })
        setStatus("success")
      } catch (error) {
        console.error(error)
        setStatus("error")
      } finally {
        setTimeout(() => setStatus("idle"), 4000)
      }
    })
  }

  return (
    <section id="waitlist" className="space-y-10 rounded-3xl border border-border/70 bg-card/70 p-8">
      <SectionHeading
        eyebrow="Programs"
        title="Retail build studio"
        description="A concierge intake for teams running multi-market launches. We seat 30 teams per quarter."
      />

      <div className="grid gap-10 lg:grid-cols-[1fr,1fr]">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Work email</label>
            <Input {...form.register("email")} placeholder="team@brand.com" />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Company</label>
            <Input {...form.register("company")} placeholder="Your company" />
            {form.formState.errors.company ? (
              <p className="text-xs text-destructive">{form.formState.errors.company.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Initiative</label>
            <Select
              value={form.watch("intent")}
              onValueChange={(value) => form.setValue("intent", value as WaitlistFormValues["intent"])}
            >
              <SelectTrigger>
                <SelectValue>
                  {(current: string | null) => {
                    const label = intents.find((intent) => intent.value === current)?.label
                    return label ?? <span className="text-muted-foreground">Select initiative</span>
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {intents.map((intent) => (
                  <SelectItem key={intent.value} value={intent.value}>
                    {intent.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea {...form.register("notes")} rows={4} placeholder="Timeline, markets, square footage..." />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Submitting" : "Join the studio"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {status === "success"
              ? "We’ll follow up within a day."
              : status === "error"
                ? "We could not save your request. Try again."
                : "We reserve seats weekly for in-flight launches."}
          </p>
        </form>

        <aside className="space-y-6 rounded-2xl border border-border/60 bg-background/60 p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Teams in line</p>
            <p className="text-4xl font-semibold">{insights.totalSignups.toLocaleString()}</p>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Recent brands stepping into the studio:</p>
            {insights.recentCompanies.length ? (
              <ul className="space-y-2 text-base font-medium">
                {insights.recentCompanies.map((company) => (
                  <li key={company} className="rounded-full border border-border/60 px-4 py-2">
                    {company}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground/80">Be the first to secure a build slot.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

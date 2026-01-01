import { cn } from "@/lib/utils"

type SectionHeadingProps = {
  eyebrow?: string
  title: string
  description?: string
  align?: "left" | "center"
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("space-y-3", align === "center" && "text-center", className)}>
      {eyebrow ? (
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
      ) : null}
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h2>
        {description ? <p className="text-base text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  )
}

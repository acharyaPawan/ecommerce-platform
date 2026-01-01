import { SectionHeading } from "@/components/shared/section-heading"

import { type EditorialDTO } from "@/modules/catalog/server/query/dto/product-dto"

import { StoryCard } from "../ui/story-card"

type EditorialSectionProps = {
  stories: EditorialDTO[]
}

export function EditorialSection({ stories }: EditorialSectionProps) {
  return (
    <section id="stories" className="space-y-8">
      <SectionHeading
        eyebrow="Field Notes"
        title="Playbooks from the build team"
        description="Dispatches from multi-market builds, sourcing updates, and capital-light rollouts."
      />
      <div className="grid gap-6 md:grid-cols-2">
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
    </section>
  )
}

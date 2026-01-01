type StoryPageProps = {
  params: { slug: string }
}

export default function StoryPage({ params }: StoryPageProps) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-20">
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Field Notes</p>
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">{params.slug}</h1>
        <p className="text-base text-muted-foreground">
          Story placeholder for {params.slug}. Replace with live content when the editorial service is ready.
        </p>
      </div>
    </div>
  )
}

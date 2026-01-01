type CollectionPageProps = {
  params: { collectionId: string }
}

export default function CollectionLanding({ params }: CollectionPageProps) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-20">
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Collections</p>
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">{params.collectionId}</h1>
        <p className="text-base text-muted-foreground">
          This placeholder route mirrors the collection view for {params.collectionId}. Wire it up to the real catalog
          service when your backend endpoints are ready.
        </p>
      </div>
    </div>
  )
}

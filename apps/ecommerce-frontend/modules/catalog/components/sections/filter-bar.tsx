"use client"

import { useQueryStates } from "nuqs"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { catalogSearchParsers } from "@/modules/catalog/lib/catalog-search-params"

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "new", label: "New arrivals" },
  { value: "price-asc", label: "Price ↑" },
  { value: "price-desc", label: "Price ↓" },
]

const tagOptions = ["modular", "hospitality", "work", "retail"]

export function FilterBar() {
  const [filters, setFilters] = useQueryStates(catalogSearchParsers, {
    history: "push",
  })

  const toggleTag = (tag: string) => {
    const currentTags = filters.tags ?? []
    const exists = currentTags.includes(tag)
    setFilters({
      tags: exists ? currentTags.filter((item) => item !== tag) : [...currentTags, tag],
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/70 p-5 md:flex-row md:items-center md:justify-between">
      <Input
        placeholder="Search catalog"
        value={filters.q ?? ""}
        onChange={(event) => setFilters({ q: event.target.value }, { shallow: false })}
        className="md:max-w-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        {sortOptions.map((option) => (
          <Button
            key={option.value}
            variant={filters.sort === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilters({ sort: option.value })}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {tagOptions.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`rounded-full border px-4 py-1 ${
              filters.tags?.includes(tag) ? "bg-primary text-primary-foreground" : "border-border/70"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}

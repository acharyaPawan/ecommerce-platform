import { type CollectionRecord, type EditorialRecord, type ProductRecord } from "./product-schema"

export const productShowcase: ProductRecord[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "adaptive-work-desk",
    name: "Adaptive Work Desk",
    shortDescription: "Standing desk with modular rail system and integrated cable spine.",
    story:
      "Built for teams that reconfigure often. Ships with soft-close drawers, USB-C power, and a matte ceramic worktop that resists rings and scratches.",
    heroImage:
      "https://images.unsplash.com/photo-1483058712412-4245e9b90334?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=800&q=80",
    ],
    price: "1999.00",
    currency: "USD",
    featured: true,
    rating: "4.9",
    reviewCount: 412,
    inventory: 28,
    category: "Workstations",
    tags: ["desk", "ergonomics", "executive"],
    badges: ["New drop", "Carbon neutral"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    slug: "atelier-chair-pro",
    name: "Atelier Chair Pro",
    shortDescription: "Italian mesh-backed task chair with adaptive lumbar zones.",
    story:
      "Dialed for multi-hour deep work. The floating seat pan lifts automatically as you shift, while the ripstop mesh keeps the form airy even in hot studios.",
    heroImage:
      "https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=800&q=80",
    ],
    price: "789.00",
    currency: "USD",
    featured: true,
    rating: "4.8",
    reviewCount: 287,
    inventory: 54,
    category: "Seating",
    tags: ["chair", "mesh", "lumbar"],
    badges: ["Ships in 48h"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    slug: "modular-storage-wall",
    name: "Modular Storage Wall",
    shortDescription: "Oak cabinetry with felt-lined bins and acoustic backing.",
    story:
      "Choose from nine modules to outfit retail walls or shared libraries. Backed with acoustic felt to absorb noise and reduce echo in open rooms.",
    heroImage:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80",
    ],
    price: "3240.00",
    currency: "USD",
    featured: false,
    rating: "4.7",
    reviewCount: 163,
    inventory: 15,
    category: "Storage",
    tags: ["storage", "oak", "acoustic"],
    badges: ["Trade exclusive"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    slug: "brushed-metal-pendant",
    name: "Brushed Metal Pendant",
    shortDescription: "High-output pendant with dual color temperature modes.",
    story:
      "Switch from warm hospitality scenes to daylight white installs with a tap. Powder-coated in micro-texture black with machine knurled edges.",
    heroImage:
      "https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=1200&q=80",
    gallery: [],
    price: "329.00",
    currency: "USD",
    featured: false,
    rating: "4.6",
    reviewCount: 211,
    inventory: 142,
    category: "Lighting",
    tags: ["lighting", "pendant"],
    badges: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    slug: "tactile-serviceware",
    name: "Tactile Serviceware Set",
    shortDescription: "Porcelain service set glazed in micro speckle stone finish.",
    story:
      "Designed with boutique cafés in mind. The kit includes four cups, saucers, and nesting trays that stack in 8 inches of shelf space.",
    heroImage:
      "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80",
    gallery: [],
    price: "189.00",
    currency: "USD",
    featured: false,
    rating: "4.9",
    reviewCount: 98,
    inventory: 73,
    category: "Serviceware",
    tags: ["porcelain", "hospitality"],
    badges: ["Bundle & save"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "00000000-0000-0000-0000-000000000006",
    slug: "linen-soft-goods",
    name: "Linen Soft Goods Kit",
    shortDescription: "Stonewashed linen throw + multi-purpose cushions.",
    story:
      "Neutral base palette featuring our closed-loop Belgian linen. Each bundle offsets 18kg of CO₂ via regenerative farm partners.",
    heroImage:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80",
    gallery: [],
    price: "248.00",
    currency: "USD",
    featured: true,
    rating: "4.8",
    reviewCount: 45,
    inventory: 120,
    category: "Soft Goods",
    tags: ["linen", "textiles"],
    badges: ["Limited"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

export const curatedCollections: CollectionRecord[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    title: "Studio Objects",
    description: "Everything we build for design studios—modular shelving, reference storage, mini bars.",
    callout: "42 SKUs refreshed monthly",
    heroImage:
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80",
    swatchOne: "#d4cdc8",
    swatchTwo: "#101010",
    metricLabel: "Re-stock cadence",
    metricValue: "Bi-weekly",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    title: "Retail Rituals",
    description: "Fixtures, cash wraps, pedestals, and lighting stories for IRL retail concepts.",
    callout: "Fabricated in North America",
    heroImage:
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80",
    swatchOne: "#f2ece3",
    swatchTwo: "#3d322c",
    metricLabel: "Lead time",
    metricValue: "4 weeks",
  },
]

export const editorialStories: EditorialRecord[] = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    eyebrow: "Playbook",
    title: "How Omni teams reset their retail fleet in 30 days",
    description:
      "We tracked three global operators refreshing 42 stores with modular fixtures. The TL;DR—kit-of-parts wins over bespoke installs every time.",
    author: "Team Field Notes",
    ctaLabel: "Read the case study",
    ctaHref: "/stories/retail-resets",
    image: "https://images.unsplash.com/photo-1484778540540-4a1d152e7d98?auto=format&fit=crop&w=1200&q=80",
    publishedAt: new Date(),
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    eyebrow: "Materials",
    title: "Why we pivoted to regenerative oak veneers",
    description:
      "A breakdown of the sourcing program, finishes that patina with use, and how your footprint drops with each collection.",
    author: "Material Studio",
    ctaLabel: "Explore the research",
    ctaHref: "/stories/regenerative-oak",
    image: "https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=1200&q=80",
    publishedAt: new Date(),
  },
]

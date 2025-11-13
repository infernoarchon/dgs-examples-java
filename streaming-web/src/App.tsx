import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Info,
  Play,
  Plus,
  Search,
  Star,
  StarHalf,
  UserRound,
  Volume2,
  X,
  Loader2,
  Pause,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchShows, type Show } from "@/lib/graphql-client"
import { fetchHeroClips, type HeroClipMap } from "@/lib/giphy"
import { cn } from "@/lib/utils"

const HERO_INTERVAL = 5500
const NAV_LINKS = ["Home", "Shows", "Movies", "New & Popular", "My List", "Browse by Languages"]
type PosterMap = Record<number, string>
type RatingMap = Record<number, { avg: number; count: number }>
type Recommendation = { title: string; reason: string }
const MY_LIST_STORAGE_KEY = "dgs-my-list"

const readStoredMyList = (): number[] => {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(MY_LIST_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((value) => (typeof value === "number" ? value : Number(value)))
      .filter((value) => Number.isFinite(value))
  } catch {
    return []
  }
}

const buildFallbackArtworkUrl = (show: Show, variant: "hero" | "tile" = "hero") => {
  const seed = encodeURIComponent(show.title.toLowerCase().replace(/\s+/g, "-"))
  const dimensions = variant === "hero" ? "1600/900" : "500/750"
  return `https://picsum.photos/seed/${seed}/${dimensions}`
}

const getArtworkForShow = (show: Show, posters: PosterMap, variant: "hero" | "tile") =>
  posters[show.id] ?? buildFallbackArtworkUrl(show, variant)

const fallbackHeroDescription = (show: Show) =>
  show.synopsis ??
  `${show.title} is streaming globally on Netflix. Queue it up for a ${
    show.type === "movie" ? "feature-length thrill ride" : "fresh season binge"
  }.`

const formatRuntime = (show: Show) => {
  if (!show.runtimeMinutes) return null
  if (show.type === "movie") {
    const hours = Math.floor(show.runtimeMinutes / 60)
    const minutes = show.runtimeMinutes % 60
    if (hours && minutes) return `${hours}h ${minutes}m`
    if (hours) return `${hours}h`
    return `${minutes}m`
  }
  return `${show.runtimeMinutes}m avg`
}

const formatTop10Label = (show: Show) => {
  if (show.weeklyHoursViewedMillions && show.top10Week) {
    return `${show.weeklyHoursViewedMillions}M hours • Week of ${show.top10Week}`
  }
  if (show.popularityScore) {
    return `Popularity ${(show.popularityScore * 100).toFixed(0)}%`
  }
  return null
}

const taglineFor = (show: Show) => {
  const parts: string[] = []
  if (show.releaseYear) {
    parts.push(String(show.releaseYear))
  }
  parts.push(show.type === "movie" ? "Netflix Film" : "Netflix Series")
  if (show.maturityRating) {
    parts.push(show.maturityRating)
  }
  const runtimeLabel = formatRuntime(show)
  if (runtimeLabel) {
    parts.push(runtimeLabel)
  }
  const top10 = formatTop10Label(show)
  if (top10) {
    parts.push(top10)
  }
  return parts.join(" • ")
}

const formatCollectionLabel = (show: Show, index: number) => {
  if (show.top10Week) {
    return `Top ${index + 1} • Week of ${show.top10Week}`
  }
  if (show.collections.includes("movies")) {
    return "Now streaming on Netflix Films"
  }
  if (show.collections.includes("global")) {
    return "Global sensation"
  }
  if (show.popularityScore) {
    return `Popularity ${(show.popularityScore * 100).toFixed(0)}%`
  }
  return `#${index + 1} on Netflix`
}

const getHeroSummary = (show: Show) => fallbackHeroDescription(show)

const NETFLIX_LOGO = "/images/logos/netflix-logo.svg"
const LOGO_MAP: Record<string, string> = {
  "stranger things": "/images/logos/stranger-things-logo.svg",
  "ozark": "/images/logos/ozark-logo.svg",
  "the crown": "/images/logos/the-crown-logo.png",
  "dead to me": "/images/logos/dead-to-me-logo.png",
  "orange is the new black": "/images/logos/orange-is-the-new-black-logo.svg",
}

const resolveLogoFor = (show: Show) => {
  const key = show.title?.toLowerCase()
  return key ? LOGO_MAP[key] ?? null : null
}

const needsExtraBrightness = (show: Show) => {
  const key = show.title?.toLowerCase() ?? ""
  return key === "ozark" || key === "orange is the new black"
}

const Header = ({ onSearch }: { onSearch: () => void }) => {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 80)
    }
    onScroll()
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full pb-4 transition-colors duration-300",
        scrolled
          ? "bg-[rgb(20,20,20)] shadow-lg"
          : "bg-gradient-to-b from-black/85 via-black/30 to-transparent"
      )}
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-6 pt-4 text-sm font-medium text-neutral-200">
        <div className="flex items-center gap-8">
          <img src={NETFLIX_LOGO} alt="Netflix" className="h-6 w-auto md:h-6" />
          <nav className="hidden items-center gap-6 text-[0.95rem] md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link} href="#" className="transition hover:text-white">
                {link}
              </a>
            ))}
          </nav>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <button
            type="button"
            className="text-white/80 transition hover:text-white"
            onClick={onSearch}
            aria-label="Search and get recommendations"
          >
            <Search className="size-5" />
          </button>
          <span className="text-xs uppercase tracking-[0.2em]">Kids</span>
          <Bell className="size-5 cursor-pointer" />
          <div className="flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-neutral-400 ring-1 ring-white/20">
            <UserRound className="size-4" />
            <ChevronDown className="size-3" />
          </div>
          <a
            href="https://top10.netflix.com/"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-white/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/80 hover:text-white"
          >
            Top 10
          </a>
        </div>
      </div>
    </header>
  )
}

export default function App() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [playerState, setPlayerState] = useState<{
    show: Show | null
    clip?: string | null
  }>({ show: null, clip: null })
  const [myListIds, setMyListIds] = useState<number[]>(() => readStoredMyList())

  useEffect(() => {
    if (typeof window === "undefined") return
    setMyListIds(readStoredMyList())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(MY_LIST_STORAGE_KEY, JSON.stringify(myListIds))
  }, [myListIds])

  const {
    data: shows = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["shows"],
    queryFn: fetchShows,
    staleTime: 1000 * 60,
  })

  const heroShows = useMemo(() => {
    const spotlight = [...shows]
      .filter((show) => show.collections.includes("spotlight"))
      .sort(
        (a, b) => (a.heroPriority ?? Number.MAX_SAFE_INTEGER) - (b.heroPriority ?? Number.MAX_SAFE_INTEGER)
      )
    const picks = spotlight.length ? spotlight : shows
    return picks.slice(0, 5)
  }, [shows])
  const toggleMyList = useCallback((showId: number) => {
    setMyListIds((prev) => (prev.includes(showId) ? prev.filter((id) => id !== showId) : [...prev, showId]))
  }, [])
  const isInMyList = useCallback((showId: number) => myListIds.includes(showId), [myListIds])
  const toggleMyListForShow = useCallback(
    (show: Show) => {
      toggleMyList(show.id)
    },
    [toggleMyList]
  )
  const myListShows = useMemo(() => {
    const showById = new Map(shows.map((show) => [show.id, show]))
    return myListIds
      .map((id) => showById.get(id))
      .filter((show): show is Show => Boolean(show))
  }, [myListIds, shows])

  const ratingMap = useMemo<RatingMap>(() => {
    const map: RatingMap = {}
    shows.forEach((show) => {
      const ratingOutOf10 =
        typeof show.imdbRating === "number"
          ? show.imdbRating
          : typeof show.popularityScore === "number"
            ? show.popularityScore * 10
            : null
      if (ratingOutOf10 && ratingOutOf10 > 0) {
        map[show.id] = {
          avg: Math.min(5, Math.max(0, Number((ratingOutOf10 / 2).toFixed(1)))),
          count: show.imdbVotes ?? Math.max(1, Math.round((show.popularityScore ?? 0.5) * 100000)),
        }
      }
    })
    return map
  }, [shows])

  const topRated = useMemo(
    () =>
      [...shows]
        .filter((show) => show.type === "series" && ratingMap[show.id])
        .sort((a, b) => {
          const avgB = ratingMap[b.id]?.avg ?? 0
          const avgA = ratingMap[a.id]?.avg ?? 0
          return avgB - avgA
        })
        .slice(0, 10),
    [shows, ratingMap]
  )

  const trendingNow = useMemo(() => {
    const trending = shows.filter((show) => show.collections.includes("trending"))
    const ordered = [...trending].sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
    const fallback = shows.filter((show) => !show.collections.includes("trending"))
    return (ordered.length ? ordered : fallback).slice(0, 12)
  }, [shows])

  const omdbApiKey = import.meta.env.VITE_OMDB_API_KEY

  const posterMap = useMemo<PosterMap>(() => {
    const map: PosterMap = {}
    shows.forEach((show) => {
      if (show.poster) {
        map[show.id] = show.poster
      }
    })
    return map
  }, [shows])

  const giphySeed = useMemo(() => shows.map((show) => `${show.id}-${show.title}`).join("|"), [shows])
  const giphyApiKey = import.meta.env.VITE_GIPHY_API_KEY
  const {
    data: heroClips = {},
    isFetching: clipsLoading,
  } = useQuery({
    queryKey: ["giphy-clips", giphySeed, giphyApiKey],
    queryFn: () => fetchHeroClips(shows, giphyApiKey!),
    enabled: Boolean(giphyApiKey && shows.length),
    staleTime: 1000 * 60 * 60,
  })

  const launchPlayer = (show: Show, clip?: string | null) => {
    setPlayerState({ show, clip })
  }

  const closePlayer = () => setPlayerState({ show: null, clip: null })

  const heroSection = isLoading ? (
    <HeroSkeleton />
  ) : error ? (
    <div className="mx-auto max-w-[1400px] px-6">
      <ErrorState message={(error as Error).message} onRetry={refetch} />
    </div>
  ) : heroShows.length ? (
    <HeroCarousel
      shows={heroShows}
      posters={posterMap}
      clips={heroClips}
      onPlay={launchPlayer}
      onToggleMyList={toggleMyListForShow}
      isInMyList={isInMyList}
    />
  ) : (
    <div className="mx-auto max-w-[1400px] px-6">
      <EmptyState />
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white">
      <Header onSearch={() => setIsChatOpen(true)} />
      <section className="relative w-full">{heroSection}</section>

      <main className="relative z-20 -mt-28 mx-auto flex max-w-[1400px] flex-col gap-14 pb-20">
        <PosterStatusBanner
          omdbKeyProvided={Boolean(omdbApiKey)}
          isLoading={isLoading}
          hasArtwork={Object.keys(posterMap).length > 0}
        />
        <ClipStatusBanner
          giphyKeyProvided={Boolean(giphyApiKey)}
          isLoading={clipsLoading}
          hasClips={Object.keys(heroClips).length > 0}
        />

        {isLoading ? (
          <RowSkeleton />
        ) : error ? null : (
          <>
            <ContentRow title="Top Rated Netflix Series" shows={topRated} posters={posterMap} ratingMap={ratingMap} />
            <ContentRow
              title="Trending Now"
              shows={trendingNow}
              posters={posterMap}
              accentBadge="Top 10"
            />
            <MyListTray
              shows={myListShows}
              posters={posterMap}
              ratingMap={ratingMap}
              onToggleMyList={toggleMyListForShow}
            />
          </>
        )}
      </main>
      <ChatSidebar
        open={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        shows={shows}
        ratingMap={ratingMap}
        posterMap={posterMap}
        clips={heroClips}
        onLaunchPlayer={(show, clip) => launchPlayer(show, clip)}
        onToggleMyList={toggleMyListForShow}
        isInMyList={isInMyList}
      />
      <PlayerOverlay
        state={playerState}
        onClose={closePlayer}
        fallback={(show) => getArtworkForShow(show, posterMap, "hero")}
      />
    </div>
  )
}

const HeroCarousel = ({
  shows,
  posters,
  clips,
  onPlay,
  onToggleMyList,
  isInMyList,
}: {
  shows: Show[]
  posters: PosterMap
  clips: HeroClipMap
  onPlay: (show: Show, clip?: string | null) => void
  onToggleMyList?: (show: Show) => void
  isInMyList?: (showId: number) => boolean
}) => {
  const [current, setCurrent] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    setCurrent(0)
    setIsAnimating(false)
  }, [shows])

  useEffect(() => {
    if (shows.length <= 1) return
    const timer = setInterval(() => {
      setIsAnimating(false)
      requestAnimationFrame(() => {
        setCurrent((prev) => (prev + 1) % shows.length)
      })
    }, HERO_INTERVAL)
    return () => clearInterval(timer)
  }, [shows])

  const activeShow = shows[current]
  if (!activeShow) return null

  const goTo = (offset: number) => {
    setIsAnimating(false)
    requestAnimationFrame(() => {
      setCurrent((prev) => {
        const next = (prev + offset + shows.length) % shows.length
        return next
      })
    })
  }

  const heroClipData = clips[activeShow.id] || {}
  const heroClip = heroClipData.secondary ?? heroClipData.primary ?? null
  const backgroundFallback = getArtworkForShow(activeShow, posters, "hero")
  const isVideo = heroClip ? /\.mp4($|\?)/i.test(heroClip) : false
  const savedToList = isInMyList?.(activeShow.id) ?? false

  return (
    <section className="relative h-[calc(100vh-70px)] min-h-[560px] w-full overflow-hidden bg-black">
      <div className="absolute inset-0">
        {heroClip ? (
          isVideo ? (
            <video
              key={heroClip}
              className={cn(
                "h-full w-full object-cover transition duration-700 ease-in-out",
                isAnimating ? "opacity-100 translate-x-0" : "opacity-0 translate-x-3"
              )}
              autoPlay
              loop
              muted
              playsInline
              poster={backgroundFallback}
              preload="auto"
              onCanPlay={(event) => {
                const video = event.currentTarget
                if (video.paused) {
                  void video.play().catch(() => {
                    /* autoplay can fail silently */
                  })
                }
                requestAnimationFrame(() => setIsAnimating(true))
              }}
            >
              <source src={heroClip} type="video/mp4" />
            </video>
          ) : (
            <img
              key={heroClip}
              src={heroClip}
              alt={`${activeShow.title} clip`}
              className={cn(
                "h-full w-full object-cover transition duration-700 ease-in-out",
                isAnimating ? "opacity-100 translate-x-0" : "opacity-0 translate-x-3"
              )}
              onLoad={() => requestAnimationFrame(() => setIsAnimating(true))}
              loading="eager"
            />
          )
        ) : (
          <img
            src={backgroundFallback}
            alt={`${activeShow.title} artwork`}
            className="h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
        )}
      </div>
      <div
        className={cn(
          "hero-gradient absolute inset-0 transition duration-700 ease-in-out",
          isAnimating ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
        )}
      />

      <div
        className={cn(
          "relative z-10 mx-auto flex h-full w-full max-w-[1400px] flex-col justify-end pb-24 pt-12 transition duration-700 ease-in-out",
          isAnimating ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"
        )}
      >
        <div className="max-w-4xl space-y-4 transition duration-700 ease-in-out">
          <img src={NETFLIX_LOGO} alt="Netflix" className="h-10 w-auto md:h-8" />
          {resolveLogoFor(activeShow) ? (
            <div className="inline-flex h-24 w-auto items-center md:h-20 pt-6">
              <img
                src={resolveLogoFor(activeShow)!}
                alt={`${activeShow.title} logo`}
                className={cn(
                  "w-auto max-h-24 max-w-xl",
                  needsExtraBrightness(activeShow) ? "brightness-200 invert grayscale contrast-200" : ""
                )}
              />
            </div>
          ) : (
            <h1 className="text-3xl font-bold leading-tight tracking-tight drop-shadow-md md:text-6xl">
              {activeShow.title}
            </h1>
          )}
          <p className="max-w-5xl text-lg text-neutral-100">{getHeroSummary(activeShow)}</p>
          <div className="flex flex-wrap gap-3 transition duration-700 ease-in-out">
            <Button
              size="lg"
              className="gap-2 rounded bg-white px-6 text-base font-semibold text-black hover:bg-white/90"
              onClick={() => onPlay(activeShow, heroClipData.primary ?? heroClip)}
            >
              <Play className="size-5 text-black" fill="currentColor" />
              Play
            </Button>
            {onToggleMyList && isInMyList ? (
              <Button
                size="lg"
                variant="outline"
                className={cn(
                  "gap-2 rounded px-6 text-base font-semibold text-white transition",
                  savedToList ? "bg-white/30 hover:bg-white/40" : "bg-white/20 hover:bg-white/30"
                )}
                onClick={() => onToggleMyList(activeShow)}
              >
                {savedToList ? <Check className="size-5" /> : <Plus className="size-5" />}
                {savedToList ? "In My List" : "My List"}
              </Button>
            ) : null}
            <Button
              size="lg"
              variant="outline"
              className="gap-2 rounded bg-white/20 px-6 text-base font-semibold text-white hover:bg-white/30"
              onClick={() => {
                if (activeShow.netflixUrl) {
                  window.open(activeShow.netflixUrl, "_blank", "noopener,noreferrer")
                }
              }}
            >
              <Info className="size-5" />
              More Info
            </Button>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between text-sm text-neutral-100 transition duration-700 ease-in-out">
          <div className="flex items-center gap-4">
            <span className="rounded border border-white/50 px-3 py-1 text-xs font-semibold">
              {activeShow.maturityRating ?? "TV-14"}
            </span>
            <span>{taglineFor(activeShow)}</span>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <IconPill aria-label="Toggle volume">
              <Volume2 className="size-4" />
            </IconPill>
            <IconPill aria-label="Previous title" onClick={() => goTo(-1)}>
              <ArrowLeft className="size-4" />
            </IconPill>
            <IconPill aria-label="Next title" onClick={() => goTo(1)}>
              <ArrowRight className="size-4" />
            </IconPill>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          {shows.map((show, index) => (
            <button
              key={show.id}
              aria-label={`Go to ${show.title}`}
              onClick={() => {
                setIsAnimating(false)
                requestAnimationFrame(() => setCurrent(index))
              }}
              className={cn(
                "h-1 rounded-full transition-all",
                index === current ? "w-12 bg-white" : "w-5 bg-white/40"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

const useHorizontalScrollControls = (depsKey?: unknown) => {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [scrollState, setScrollState] = useState({ prev: false, next: false })

  const updateScrollState = useCallback(() => {
    const node = listRef.current
    if (!node) return
    const { scrollLeft, scrollWidth, clientWidth } = node
    setScrollState((prevState) => {
      const nextState = {
        prev: scrollLeft > 8,
        next: scrollLeft + clientWidth < scrollWidth - 8,
      }
      return prevState.prev === nextState.prev && prevState.next === nextState.next ? prevState : nextState
    })
  }, [])

  useEffect(() => {
    updateScrollState()
    const node = listRef.current
    if (!node) return
    const handleScroll = () => updateScrollState()
    node.addEventListener("scroll", handleScroll)
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateScrollState)
    }
    return () => {
      node.removeEventListener("scroll", handleScroll)
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateScrollState)
      }
    }
  }, [updateScrollState, depsKey])

  const scrollByCards = useCallback((direction: -1 | 1) => {
    const node = listRef.current
    if (!node) return
    const scrollAmount = node.clientWidth ? node.clientWidth * 0.9 : 320
    node.scrollBy({ left: direction * scrollAmount, behavior: "smooth" })
  }, [])

  return { listRef, scrollState, scrollByCards }
}

const ContentRow = ({
  title,
  shows,
  posters,
  accentBadge,
  ratingMap,
}: {
  title: string
  shows: Show[]
  posters: PosterMap
  accentBadge?: string
  ratingMap?: RatingMap
}) => {
  const { listRef, scrollState, scrollByCards } = useHorizontalScrollControls(shows.length)

  if (!shows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No titles matched this collection yet — update the Netflix catalog seeds to curate more.
      </p>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {accentBadge ? (
          <Badge className="bg-amber-500 text-xs font-semibold text-black">{accentBadge}</Badge>
        ) : null}
      </div>
      <div className="relative">
        <div ref={listRef} className="flex gap-5 overflow-x-auto pb-2 no-scrollbar scroll-smooth pr-6">
          {shows.map((show, index) => (
            <Card
              key={`${title}-${show.id}-${index}`}
              className="group relative w-[230px] shrink-0 overflow-visible border-none bg-transparent text-left shadow-none"
            >
              <div className="relative aspect-video overflow-hidden rounded-lg shadow-lg transition hover:scale-[1.03]">
                <img
                  src={getArtworkForShow(show, posters, "tile")}
                  alt={`${show.title} poster`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <CardContent className="space-y-1 px-0 pt-3">
                {ratingMap && ratingMap[show.id] ? (
                  <div className="flex items-center gap-2">
                    <RatingStars value={ratingMap[show.id].avg} />
                    <span className="text-xs text-neutral-400">
                      {ratingMap[show.id].avg.toFixed(1)} / 5
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">{formatCollectionLabel(show, index)}</p>
                )}
                <h3 className="text-lg font-semibold leading-tight text-white capitalize">{show.title.toLowerCase()}</h3>
              </CardContent>
            </Card>
          ))}
        </div>
        {scrollState.prev ? (
          <button
            type="button"
            className="absolute left-0 top-1/3 z-10 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white shadow-lg transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white/60"
            onClick={() => scrollByCards(-1)}
            aria-label={`Scroll ${title} backward`}
          >
            <ArrowLeft className="size-5" />
          </button>
        ) : null}
        {scrollState.next ? (
          <button
            type="button"
            className="absolute right-0 top-1/3 z-10 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white shadow-lg transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white/60"
            onClick={() => scrollByCards(1)}
            aria-label={`Scroll ${title} forward`}
          >
            <ArrowRight className="size-5" />
          </button>
        ) : null}
      </div>
    </section>
  )
}

const MyListTray = ({
  shows,
  posters,
  ratingMap,
  onToggleMyList,
}: {
  shows: Show[]
  posters: PosterMap
  ratingMap: RatingMap
  onToggleMyList: (show: Show) => void
}) => (
  <section>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-white">My List</h2>
      </div>
      {shows.length ? <span className="text-xs text-neutral-400">{shows.length} titles</span> : null}
    </div>
    {shows.length ? (
      <HorizontalCarousel shows={shows} onToggleMyList={onToggleMyList} posters={posters} ratingMap={ratingMap} />
    ) : (
      <div className="mt-6 rounded-2xl border border-dashed border-white/30 bg-black/30 p-6 text-sm text-neutral-300">
        Use the My List buttons across the app (and inside the AI assistant) to pin titles here.
      </div>
    )}
  </section>
)

const HorizontalCarousel = ({
  shows,
  posters,
  ratingMap,
  onToggleMyList,
}: {
  shows: Show[]
  posters: PosterMap
  ratingMap: RatingMap
  onToggleMyList: (show: Show) => void
}) => {
  const { listRef, scrollState, scrollByCards } = useHorizontalScrollControls(shows.length)

  return (
    <div className="relative mt-6">
      <div ref={listRef} className="flex gap-5 overflow-x-auto pb-2 pr-6 no-scrollbar scroll-smooth">
        {shows.map((show, index) => (
          <Card
            key={`my-list-${show.id}`}
            className="group relative w-[230px] shrink-0 overflow-visible border-none bg-transparent text-left shadow-none"
          >
            <div className="relative aspect-video overflow-hidden rounded-lg shadow-lg transition hover:scale-[1.03]">
              <img
                src={getArtworkForShow(show, posters, "tile")}
                alt={`${show.title} poster`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <button
                type="button"
                className="absolute right-3 top-3 inline-flex items-center justify-center rounded-full bg-black/70 p-2 text-xs uppercase tracking-[0.3em] text-white opacity-0 transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 group-hover:opacity-100"
                onClick={() => onToggleMyList(show)}
                aria-label={`Remove ${show.title} from My List`}
              >
                <X className="size-4" />
              </button>
            </div>
            <CardContent className="space-y-1 px-0 pt-3">
              {ratingMap[show.id] ? (
                <div className="flex items-center gap-2">

                </div>
              ) : (
                <p className="text-sm text-neutral-400">{taglineFor(show)}</p>
              )}
              <h3 className="text-lg font-semibold leading-tight text-white capitalize">{show.title.toLowerCase()}</h3>
              {!ratingMap[show.id] ? (
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Pinned</p>
              ) : (
                <p className="text-xs text-neutral-500"></p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {scrollState.prev ? (
        <button
          type="button"
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white shadow-lg transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white/60"
          onClick={() => scrollByCards(-1)}
          aria-label="Scroll My List backward"
        >
          <ArrowLeft className="size-5" />
        </button>
      ) : null}
      {scrollState.next ? (
        <button
          type="button"
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white shadow-lg transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white/60"
          onClick={() => scrollByCards(1)}
          aria-label="Scroll My List forward"
        >
          <ArrowRight className="size-5" />
        </button>
      ) : null}
    </div>
  )
}

const PosterStatusBanner = ({
  omdbKeyProvided,
  isLoading,
  hasArtwork,
}: {
  omdbKeyProvided: boolean
  isLoading: boolean
  hasArtwork: boolean
}) => {
  if (!omdbKeyProvided) {
    return (
      <div className="rounded-xl bg-white/5 px-5 py-3 text-sm text-neutral-300">
        Using placeholder artwork. Set <code className="text-xs">VITE_OMDB_API_KEY</code> to pull official posters and
        plots from OMDb.
      </div>
    )
  }

  return (
    <div className="rounded-xl text-sm text-emerald-100">
      {isLoading
        ? "Building the Netflix catalog with OMDb metadata..."
        : hasArtwork
          ? ""
          : "OMDb did not return posters for these titles yet."}
    </div>
  )
}

const ClipStatusBanner = ({
  giphyKeyProvided,
  isLoading,
  hasClips,
}: {
  giphyKeyProvided: boolean
  isLoading: boolean
  hasClips: boolean
}) => {
  if (!giphyKeyProvided) {
    return (
      <div className="rounded-xl text-sm text-neutral-300">
        Hero art uses static imagery. Set <code className="text-xs">VITE_GIPHY_API_KEY</code> to enable autoplay clips.
      </div>
    )
  }

  return (
    <div className="rounded-xl text-sm text-sky-100">
      {isLoading
        ? "Fetching hero clips from Giphy..."
        : hasClips
          ? ""
          : "No clips were returned for these titles yet."}
    </div>
  )
}

const RatingStars = ({ value }: { value: number }) => {
  const stars = []
  for (let i = 1; i <= 5; i += 1) {
    const diff = value - i + 1
    if (diff >= 0.75) {
      stars.push(
        <Star key={i} className="size-4 text-yellow-400" fill="currentColor" strokeWidth={0} />
      )
    } else if (diff >= 0.25) {
      stars.push(<StarHalf key={i} className="size-4 text-yellow-400" />)
    } else {
      stars.push(<Star key={i} className="size-4 text-white/30" />)
    }
  }

  return <div className="flex items-center gap-1">{stars}</div>
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  recommendations?: Recommendation[]
}

const ChatSidebar = ({
  open,
  onClose,
  shows,
  ratingMap,
  posterMap,
  clips,
  onLaunchPlayer,
  onToggleMyList,
  isInMyList,
}: {
  open: boolean
  onClose: () => void
  shows: Show[]
  ratingMap: RatingMap
  posterMap: PosterMap
  clips: HeroClipMap
  onLaunchPlayer: (show: Show, clip?: string | null) => void
  onToggleMyList: (show: Show) => void
  isInMyList: (showId: number) => boolean
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! Tell me what you're in the mood for and I'll recommend a show from this catalog.",
    },
  ])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const openAiKey = import.meta.env.VITE_OPENAI_API_KEY

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  const showContext = useMemo(
    () =>
      shows.map((show) => ({
        title: show.title,
        type: show.type,
        releaseYear: show.releaseYear,
        maturityRating: show.maturityRating,
        synopsis: show.synopsis,
        avgRating: ratingMap[show.id]?.avg ?? null,
        imdbRating: show.imdbRating ?? null,
        poster: posterMap[show.id] ?? null,
        collections: show.collections,
        tags: show.tags,
        netflixUrl: show.netflixUrl,
      })),
    [shows, ratingMap, posterMap]
  )

  const findShowByTitle = (title: string) =>
    shows.find((show) => show.title.toLowerCase() === title.toLowerCase())

  const handleSend = async () => {
    if (!input.trim() || !openAiKey) return
    const userMessage: ChatMessage = { role: "user", content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsSending(true)

    const prompt = [
      "You are a Netflix programming concierge for an OMDb-enriched catalog.",
      "Only recommend titles that exist in the provided catalog JSON (all are available on Netflix).",
      "Return JSON matching {\"summary\": string, \"recommendations\": [{\"title\": string, \"reason\": string}]} with at most 3 items and reference genres, tags, or maturity ratings when relevant.",
      "Catalog:",
      JSON.stringify(showContext),
      `User request: ${userMessage.content}`,
    ].join("\n")

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5-nano",
          input: prompt,
        }),
      })
      const data = await response.json()
      const textFromOutput =
        data?.output?.map((chunk: { content?: Array<{ text?: string }> }) =>
          chunk.content?.map((piece) => piece.text ?? "").join("")
        ).join("") ??
        data?.output_text ??
        data?.choices?.[0]?.message?.content ??
        "{}"

      const cleaned = textFromOutput.trim().replace(/^```json\s*/i, "").replace(/```$/i, "")
      let parsed: { summary?: string; recommendations?: Recommendation[] } | null = null
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        parsed = null
      }

      if (parsed?.recommendations?.length) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: parsed.summary?.trim() || "Here are a few titles you might love:",
            recommendations: parsed.recommendations,
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: textFromOutput.trim() || "I couldn't generate a recommendation right now.",
          },
        ])
      }
    } catch (error) {
      console.error("Chat error", error)
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't reach the AI service. Try again later." },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-[#0f0f0f] text-white shadow-2xl transition-transform duration-300 md:w-[420px]",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">Ask Netflix</p>
            <h3 className="text-xl font-semibold">Watch Recommendations</h3>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/30 p-2 text-white/80 hover:text-white"
            onClick={onClose}
            aria-label="Close recommendations"
          >
            <X className="size-4" />
          </button>
        </div>
        {!openAiKey ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-sm text-neutral-400">
            <p>
              Add <code className="text-xs">VITE_OPENAI_API_KEY</code> to enable AI-powered
              recommendations.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {messages.map((message, index) => {
                const isAssistant = message.role === "assistant"
                const recs = message.recommendations?.map((rec) => {
                  const show = findShowByTitle(rec.title)
                  const clip =
                    show ? clips[show.id]?.primary ?? clips[show.id]?.secondary ?? null : null
                  return { rec, show, clip }
                })
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn(
                      "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      isAssistant ? "bg-white/5 text-white" : "bg-[#e50914] text-white ml-auto"
                    )}
                  >
                    {message.content && (
                      <div className="space-y-2 text-sm [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_strong]:font-semibold">
                        <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,
                          ul: ({ children }) => (
                            <ul className="list-disc space-y-1 pl-4">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal space-y-1 pl-4">{children}</ol>
                          ),
                          li: ({ children }) => (
                            <li className="text-sm leading-relaxed">{children}</li>
                          ),
                        }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {recs && recs.length ? (
                      <div className="mt-4 space-y-3">
                        {recs.map(({ rec, show, clip }) => (
                          <div
                            key={`${rec.title}-${rec.reason}`}
                            className="rounded-xl border border-white/15 bg-black/40 p-4"
                          >
                            <div className="relative aspect-video overflow-hidden rounded-lg">
                              <img
                                src={
                                  show && posterMap[show.id]
                                    ? posterMap[show.id]
                                    : buildFallbackArtworkUrl(
                                        { title: rec.title } as Show,
                                        "tile"
                                      )
                                }
                                alt={`${rec.title} artwork`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            {show && ratingMap[show.id]?.avg ? (
                              <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
                                <RatingStars value={ratingMap[show.id].avg} />
                                <span>{ratingMap[show.id].avg.toFixed(1)}/5</span>
                              </div>
                            ) : null}
                            <h4 className="mt-2 text-lg font-semibold">{rec.title}</h4>
                            <p className="text-sm text-neutral-300">{rec.reason}</p>
                            {show ? (
                              <div className="mt-4 space-y-2">
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-black transition hover:bg-white"
                                  onClick={() => onLaunchPlayer(show, clip)}
                                >
                                  <Play className="size-3" fill="currentColor" />
                                  Watch
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 transition hover:border-white hover:text-white"
                                  onClick={() => onToggleMyList(show)}
                                >
                                  {isInMyList(show.id) ? (
                                    <Check className="size-3" />
                                  ) : (
                                    <Plus className="size-3" />
                                  )}
                                  {isInMyList(show.id) ? "In My List" : "Add to My List"}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <div className="border-t border-white/10 p-4">
              <div className="rounded-2xl border border-white/20 bg-black/40">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask for a thriller, something funny, etc."
                  className="h-24 w-full resize-none bg-transparent px-4 py-3 text-sm outline-none"
                />
                <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
                  <span className="text-xs text-neutral-500">Powered by GPT-5 Nano</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
                    onClick={() => void handleSend()}
                    disabled={isSending || !input.trim()}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Thinking
                      </>
                    ) : (
                      "Send"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

const PlayerOverlay = ({
  state,
  onClose,
  fallback,
}: {
  state: { show: Show | null; clip?: string | null }
  onClose: () => void
  fallback: (show: Show) => string
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)

  useEffect(() => {
    if (state.show) {
      setIsVisible(true)
      const zoomTimer = setTimeout(() => setIsZoomed(true), 120)
      return () => {
        clearTimeout(zoomTimer)
        setIsVisible(false)
        setIsZoomed(false)
      }
    }
  }, [state.show])

  useEffect(() => {
    if (state.show && videoRef.current && state.clip && /\.mp4/i.test(state.clip)) {
      const video = videoRef.current
      video.play().catch(() => setIsPlaying(false))
    }
  }, [state])

  if (!state.show) return null

  const clip = state.clip
  const isVideo = clip ? /\.mp4($|\?)/i.test(clip) : false
  const handleToggle = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {})
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  const handleClose = () => {
    setIsVisible(false)
    setIsZoomed(false)
    setTimeout(onClose, 350)
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex bg-black transition-opacity duration-500 ease-out",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      <div
        className={cn(
          "relative h-full w-full transform transition-transform duration-700 ease-\\[cubic-bezier\\(0.22,1,0.36,1\\)\\]",
          isZoomed ? "scale-100" : "scale-[1.02]"
        )}
      >
        <div className="absolute inset-0">
          {clip ? (
            isVideo ? (
              <video
                ref={videoRef}
                src={clip}
                className="h-full w-full object-cover"
                autoPlay
                loop
                muted
                poster={fallback(state.show)}
              />
            ) : (
              <img src={clip} alt={state.show.title} className="h-full w-full object-cover" />
            )
          ) : (
            <img src={fallback(state.show)} alt={state.show.title} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="relative z-10 flex h-full flex-col justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent">
          <div className="flex items-center justify-between px-6 pt-6 text-white">
            <button className="flex items-center gap-2 text-lg font-semibold" onClick={handleClose}>
              <ArrowLeft className="size-6" />
              <span>Back</span>
            </button>
            <div className="flex gap-4 text-xl text-white/70">
              <Volume2 className="size-5" />
            </div>
          </div>
          <div className="px-6 pb-6">
            <div className="mb-4 h-1 w-full rounded-full bg-white/20">
              <div className="h-full w-1/4 rounded-full bg-red-600" />
            </div>
            <div className="flex items-center gap-4 text-white">
              <button
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black"
                onClick={handleToggle}
              >
                {isPlaying ? <Pause className="size-6" /> : <Play className="size-6" fill="currentColor" />}
              </button>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-white/60">Now Playing</p>
                <p className="text-2xl font-semibold">{state.show.title}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const HeroSkeleton = () => (
  <section className="h-[calc(100vh-70px)] min-h-[560px] w-full overflow-hidden bg-card">
    <Skeleton className="h-full w-full" />
  </section>
)

const RowSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-6 w-64" />
    <div className="flex gap-5 overflow-hidden">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="w-[230px] shrink-0 space-y-3">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  </div>
)

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-start gap-4 rounded-3xl border border-red-500/40 bg-red-500/10 px-6 py-8">
    <div>
      <p className="text-sm uppercase tracking-[0.4em] text-red-200">Something went wrong</p>
      <h2 className="text-2xl font-semibold text-red-100">{message}</h2>
    </div>
    <Button variant="secondary" onClick={() => onRetry()}>
      Try again
    </Button>
  </div>
)

const EmptyState = () => (
  <div className="rounded-3xl border border-white/10 bg-card/40 px-6 py-16 text-center">
    <h2 className="text-2xl font-semibold">No shows yet</h2>
    <p className="mt-2 text-muted-foreground">
      Update <code className="text-xs">src/data/netflix-catalog.ts</code> with more titles to grow this catalog.
    </p>
  </div>
)

const IconPill = ({ children, className, type, ...props }: ComponentProps<"button">) => (
  <button
    type={type ?? "button"}
    className={cn(
      "flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition hover:border-white/70",
      className
    )}
    {...props}
  >
    {children}
  </button>
)

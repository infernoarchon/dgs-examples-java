import { useEffect, useMemo, useState, type ComponentProps } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronDown,
  Info,
  Play,
  Search,
  Star,
  StarHalf,
  UserRound,
  Volume2,
  X,
  Loader2,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchShows, type Show } from "@/lib/graphql-client"
import { fetchHeroClips, type HeroClipMap } from "@/lib/giphy"
import { fetchOmdbDetails, type OmdbDetailsMap } from "@/lib/omdb"
import { cn } from "@/lib/utils"

const HERO_INTERVAL = 5500
const NAV_LINKS = ["Home", "Shows", "Movies", "New & Popular", "My List", "Browse by Languages"]
type PosterMap = Record<number, string>
type RatingMap = Record<number, { avg: number; count: number }>

const buildFallbackArtworkUrl = (show: Show, variant: "hero" | "tile" = "hero") => {
  const seed = encodeURIComponent(show.title.toLowerCase().replace(/\s+/g, "-"))
  const dimensions = variant === "hero" ? "1600/900" : "500/750"
  return `https://picsum.photos/seed/${seed}/${dimensions}`
}

const getArtworkForShow = (show: Show, posters: PosterMap, variant: "hero" | "tile") =>
  posters[show.id] ?? buildFallbackArtworkUrl(show, variant)

const fallbackHeroDescription = (show: Show) =>
  `All ${show.title} episodes from the DGS sample API are ready to stream. Hop back to ${
    show.releaseYear ?? "the latest"
  } nostalgia in one click.`

const taglineFor = (show: Show) =>
  `${show.releaseYear ?? "Brand new"} • GraphQL id #${show.id}`

const getHeroSummary = (show: Show, details: OmdbDetailsMap) =>
  details[show.id]?.plot ?? fallbackHeroDescription(show)

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
          <span className="text-3xl font-bold text-[#e50914]">NETFLIX</span>
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
            href="http://localhost:8080/graphiql"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-white/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/80 hover:text-white"
          >
            GraphiQL
          </a>
        </div>
      </div>
    </header>
  )
}

export default function App() {
  const [isChatOpen, setIsChatOpen] = useState(false)
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

  const curated = useMemo(() => shows.slice(0, 5), [shows])

  const ratingMap = useMemo<RatingMap>(() => {
    const map: RatingMap = {}
    shows.forEach((show) => {
      const scores = (show.reviews ?? []).map((review) => review.starScore).filter((s): s is number => typeof s === "number")
      if (scores.length) {
        const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length
        map[show.id] = { avg, count: scores.length }
      }
    })
    return map
  }, [shows])

  const topRated = useMemo(
    () =>
      [...shows]
        .filter((show) => ratingMap[show.id])
        .sort((a, b) => {
          const avgB = ratingMap[b.id]?.avg ?? 0
          const avgA = ratingMap[a.id]?.avg ?? 0
          return avgB - avgA
        })
        .slice(0, 10),
    [shows, ratingMap]
  )
  const omdbApiKey = import.meta.env.VITE_OMDB_API_KEY
  const posterKey = useMemo(() => shows.map((show) => `${show.id}-${show.title}`).join("|"), [shows])

  const {
    data: omdbDetails = {},
    isFetching: postersLoading,
  } = useQuery<OmdbDetailsMap>({
    queryKey: ["omdb-posters", posterKey, omdbApiKey],
    queryFn: () => fetchOmdbDetails(shows, omdbApiKey!),
    enabled: Boolean(omdbApiKey && shows.length),
    staleTime: 1000 * 60 * 60,
  })

  const posterMap = useMemo<PosterMap>(() => {
    const map: PosterMap = {}
    Object.entries(omdbDetails).forEach(([id, meta]) => {
      if (meta.poster) {
        map[Number(id)] = meta.poster
      }
    })
    return map
  }, [omdbDetails])

  const giphyApiKey = import.meta.env.VITE_GIPHY_API_KEY
  const {
    data: heroClips = {},
    isFetching: clipsLoading,
  } = useQuery({
    queryKey: ["giphy-clips", posterKey, giphyApiKey],
    queryFn: () => fetchHeroClips(shows, giphyApiKey!),
    enabled: Boolean(giphyApiKey && shows.length),
    staleTime: 1000 * 60 * 60,
  })

  const heroSection = isLoading ? (
    <HeroSkeleton />
  ) : error ? (
    <div className="mx-auto max-w-[1400px] px-6">
      <ErrorState message={(error as Error).message} onRetry={refetch} />
    </div>
  ) : curated.length ? (
    <HeroCarousel shows={curated} posters={posterMap} clips={heroClips} details={omdbDetails} />
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
          isLoading={postersLoading}
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
            <ContentRow
              title="Top Rated TV Shows"
              shows={topRated}
              posters={posterMap}
              ratingMap={ratingMap}
            />
            <ContentRow
              title="Trending Now"
              shows={[...shows].reverse()}
              posters={posterMap}
              accentBadge="Top 10"
            />
          </>
        )}
      </main>
      <ChatSidebar
        open={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        shows={shows}
        ratingMap={ratingMap}
      />
    </div>
  )
}

const HeroCarousel = ({
  shows,
  posters,
  clips,
  details,
}: {
  shows: Show[]
  posters: PosterMap
  clips: HeroClipMap
  details: OmdbDetailsMap
}) => {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    setCurrent(0)
  }, [shows])

  useEffect(() => {
    if (shows.length <= 1) return
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % shows.length)
    }, HERO_INTERVAL)
    return () => clearInterval(timer)
  }, [shows])

  const activeShow = shows[current]
  if (!activeShow) return null

  const goTo = (offset: number) => {
    setCurrent((prev) => {
      const next = (prev + offset + shows.length) % shows.length
      return next
    })
  }

  const heroClip = clips[activeShow.id]
  const backgroundFallback = getArtworkForShow(activeShow, posters, "hero")
  const isVideo = heroClip ? /\.mp4($|\?)/i.test(heroClip) : false

  return (
    <section className="relative h-[calc(100vh-70px)] min-h-[560px] w-full overflow-hidden">
      {heroClip ? (
        isVideo ? (
          <video
            key={heroClip}
            className="absolute inset-0 h-full w-full object-cover"
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
            }}
          >
            <source src={heroClip} type="video/mp4" />
          </video>
        ) : (
          <img
            key={heroClip}
            src={heroClip}
            alt={`${activeShow.title} clip`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
        )
      ) : (
        <img
          src={backgroundFallback}
          alt={`${activeShow.title} artwork`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
      )}
      <div className="hero-gradient absolute inset-0" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1400px] flex-col justify-end px-6 pb-24 pt-12 md:px-10">
        <div className="max-w-4xl space-y-4">
          <div className="flex items-center gap-3 text-3xl font-semibold uppercase text-[#e50914]">
            Netflix
          </div>
          <h1 className="text-5xl font-bold leading-tight tracking-tight drop-shadow-md md:text-6xl">
            {activeShow.title}
          </h1>
          <p className="max-w-3xl text-lg text-neutral-100">{getHeroSummary(activeShow, details)}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="gap-2 rounded bg-white px-6 text-base font-semibold text-black hover:bg-white/90"
            >
              <Play className="size-5 text-black" fill="currentColor" />
              Play
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 rounded bg-white/20 px-6 text-base font-semibold text-white hover:bg-white/30"
            >
              <Info className="size-5" />
              More Info
            </Button>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between text-sm text-neutral-100">
          <div className="flex items-center gap-4">
            <span className="rounded border border-white/50 px-3 py-1 text-xs font-semibold">R</span>
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
              onClick={() => setCurrent(index)}
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
}) =>
  shows.length ? (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {accentBadge ? (
          <Badge className="bg-amber-500 text-xs font-semibold text-black">{accentBadge}</Badge>
        ) : null}
      </div>
      <div className="flex gap-5 overflow-x-auto pb-2">
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
                <p className="text-sm text-neutral-400">#{index + 1} in TV Shows Today</p>
              )}
              <h3 className="text-lg font-semibold leading-tight text-white capitalize">{show.title.toLowerCase()}</h3>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  ) : (
    <p className="text-sm text-muted-foreground">No shows yet — add one through the DGS backend.</p>
  )

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
        Using placeholder artwork. Set <code className="text-xs">VITE_OMDB_API_KEY</code> to pull official posters.
      </div>
    )
  }

  return (
    <div className="rounded-xl text-sm text-emerald-100">
      {isLoading
        ? "Fetching posters from OMDb..."
        : hasArtwork
          ? ""
          : "No posters were returned for these titles yet."}
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
}

const ChatSidebar = ({
  open,
  onClose,
  shows,
  ratingMap,
}: {
  open: boolean
  onClose: () => void
  shows: Show[]
  ratingMap: RatingMap
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
        releaseYear: show.releaseYear,
        avgRating: ratingMap[show.id]?.avg ?? null,
      })),
    [shows, ratingMap]
  )

  const handleSend = async () => {
    if (!input.trim() || !openAiKey) return
    const userMessage: ChatMessage = { role: "user", content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsSending(true)

    const prompt = [
      "You are a streaming concierge for the Netflix DGS sample app.",
      "Recommend shows strictly from the provided catalog JSON.",
      "List up to three titles, briefly summarizing why they match the user criteria.",
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
        "I couldn't generate a recommendation right now."

      setMessages((prev) => [...prev, { role: "assistant", content: textFromOutput.trim() }])
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
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn(
                      "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      isAssistant ? "bg-white/5 text-white" : "bg-[#e50914] text-white ml-auto"
                    )}
                  >
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
      Add shows through the Java service and they will appear here automatically.
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

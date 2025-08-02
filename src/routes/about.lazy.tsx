import { MagicCard } from "@/components/magic-cards"
import { Button } from "@/components/ui/button"
import { GitHubIcon, XIcon } from "@daveyplate/better-auth-ui"
import { Link, createLazyFileRoute } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"

export const Route = createLazyFileRoute("/about")({
    component: RouteComponent
})

function RouteComponent() {
    const developers = [
        {
            name: "Vrishank Agarwal",
            role: "100X vibe coder",
            imageUrl:
                "https://pbs.twimg.com/profile_images/1390432487571136518/5WU8q3YM_400x400.jpg",
            gradientFrom: "#6366f1",
            gradientTo: "#8b5cf6",
            twitterUrl: "https://x.com/vishyfishy2",
            githubUrl: "https://github.com/f1shy-dev"
        },
        {
            name: "Sahaj Jain",
            role: "infamous themes guy",
            imageUrl:
                "https://pbs.twimg.com/profile_images/1875562084924014592/Ir1CkasE_400x400.jpg",
            gradientFrom: "#ec4899",
            gradientTo: "#f97316",
            twitterUrl: "https://x.com/iamsahaj_xyz",
            githubUrl: "https://github.com/jnsahaj"
        },
        {
            name: "Lakshay Bhushan",
            role: "the design guy",
            imageUrl:
                "https://pbs.twimg.com/profile_images/1927471704000884736/0SetyuRy_400x400.jpg",
            gradientFrom: "#10b981",
            gradientTo: "#06b6d4",
            twitterUrl: "https://x.com/blakssh",
            githubUrl: "https://github.com/lakshaybhushan"
        },
        {
            name: "Ayush Rudani",
            role: "I forked this repo and tweaked it ;)",
            imageUrl: "https://ayushrudani.com/logo.png",
            gradientFrom: "#0955faff",
            gradientTo: "#5c66f6ff",
            twitterUrl: "https://go.ayushrudani.com/twitter",
            githubUrl: "https://go.ayushrudani.com/github"
        }
    ]

    return (
        <div className="flex h-screen flex-col overflow-y-auto bg-background">
            <div className="container mx-auto px-4 py-12 md:py-24 lg:max-w-4xl">
                {/* Header with back button */}
                <div className="mb-6 flex items-center gap-4">
                    <Link to="/">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                </div>

                {/* Header Section */}
                <div className="mb-16 text-center">
                    <h1 className="mb-6 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text font-bold text-5xl text-transparent lg:text-7xl">
                        Who tf are we?
                    </h1>
                    <p className="mx-auto max-w-3xl text-muted-foreground text-xl leading-relaxed">
                        ...So, three random guys from the everything app came together because Theo
                        didn't open source T3 Chat.
                    </p>
                </div>

                {/* Developer Cards */}
                <div className="mb-16 grid grid-cols-1 gap-8 rounded-lg lg:grid-cols-3">
                    {developers.map((dev, index) => (
                        <MagicCard
                            key={index}
                            className="h-full rounded-lg p-0"
                            gradientFrom={dev.gradientFrom}
                            gradientTo={dev.gradientTo}
                            gradientSize={300}
                            gradientOpacity={0.1}
                        >
                            <div className="flex h-full flex-col px-4 py-6">
                                {/* Profile Image */}
                                <div className="mb-4 flex justify-center">
                                    <div className="relative">
                                        <div
                                            className="absolute inset-0 rounded-full bg-gradient-to-r p-1"
                                            style={{
                                                background: `linear-gradient(135deg, ${dev.gradientFrom}, ${dev.gradientTo})`
                                            }}
                                        >
                                            <div className="h-full w-full rounded-full bg-background" />
                                        </div>
                                        <img
                                            src={dev.imageUrl}
                                            alt={`${dev.name} profile`}
                                            className="relative h-24 w-24 rounded-full object-cover"
                                        />
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 text-center">
                                    <h3 className="mb-2 font-bold text-2xl">{dev.name}</h3>

                                    <h4 className="mb-4 font-semibold text-foreground/90 text-lg">
                                        {dev.role}
                                    </h4>
                                </div>

                                {/* Social Links */}
                                <div className="flex justify-center gap-4">
                                    <Button
                                        type="button"
                                        onClick={() =>
                                            window.open(
                                                dev.twitterUrl,
                                                "_blank",
                                                "noopener,noreferrer"
                                            )
                                        }
                                        variant="secondary"
                                    >
                                        <XIcon className="h-4 w-4" />
                                        <span className="font-medium text-sm">Twitter</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() =>
                                            window.open(
                                                dev.githubUrl,
                                                "_blank",
                                                "noopener,noreferrer"
                                            )
                                        }
                                        variant="secondary"
                                    >
                                        <GitHubIcon className="h-4 w-4" />
                                        <span className="font-medium text-sm">GitHub</span>
                                    </Button>
                                </div>
                            </div>
                        </MagicCard>
                    ))}
                </div>

                {/* Project Section */}
                <MagicCard
                    className="mb-8 rounded-lg p-0"
                    gradientFrom="#9E7AFF"
                    gradientTo="#FE8BBB"
                    gradientSize={400}
                    gradientOpacity={0.08}
                >
                    <div className="p-12 text-center">
                        <h2 className="mb-6 font-bold text-3xl lg:text-4xl">
                            Built with ❤️ and innovation
                        </h2>
                        <p className="mx-auto mb-4 max-w-3xl text-lg text-muted-foreground leading-relaxed">
                            ...and maybe a LOT of Cursor usage. (Claude 4 Sonnet for the win). Just
                            joking... Even though it was made by interns, that doesn't mean it isn't
                            the best OSS chat app. We worked relentlessly to design new features,
                            craft every interaction and ship the best experience we could.
                        </p>
                        <p className="mx-auto mb-4 max-w-3xl text-lg text-muted-foreground leading-relaxed">
                            This project was built as part of the{" "}
                            <a
                                href="https://x.com/theo/status/1931515264497254402"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-foreground hover:underline"
                            >
                                T3 Chat Cloneathon
                            </a>
                            , where developers came together to create open-source alternatives to
                            T3 Chat.
                        </p>
                        <p className="mx-auto max-w-3xl text-lg text-muted-foreground leading-relaxed">
                            Inspired by the not-open-source T3 Chat and some certain long youtube
                            videos about database sync, we decided to go with Convex as our main
                            sync layer. The AI SDK really helped us out with being able to setup
                            tons of AI models, and features like resumable streams.
                        </p>
                    </div>
                </MagicCard>

                {/* Tech Stack Section */}
                <MagicCard
                    className="rounded-lg p-0"
                    gradientFrom="#10b981"
                    gradientTo="#06b6d4"
                    gradientSize={400}
                    gradientOpacity={0.08}
                >
                    <div className="p-12 text-center">
                        <h2 className="mb-6 font-bold text-3xl lg:text-4xl">Tech Stack</h2>
                        <p className="mx-auto mb-8 max-w-3xl text-lg text-muted-foreground leading-relaxed">
                            Built with modern tools and technologies to deliver the best developer
                            and user experience.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">Tanstack Start</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">React</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">TypeScript</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">Convex</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">TailwindCSS</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">Better Auth</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">Framer Motion</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">AI SDK</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">Vite</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">PostgreSQL</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">Drizzle ORM</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">shadcn-ui</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">tweakcn</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">BiomeJS</span>
                            </div>
                            <div className="rounded-full bg-foreground/5 px-4 py-2">
                                <span className="font-medium text-sm">Bun</span>
                            </div>
                        </div>
                    </div>
                </MagicCard>
            </div>
        </div>
    )
}

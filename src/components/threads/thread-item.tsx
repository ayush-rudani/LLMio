import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"
import { useParams } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import equal from "fast-deep-equal/es6"
import { Edit3, FolderOpen, MoreHorizontal, Pin, Trash2 } from "lucide-react"
import { memo, useState } from "react"
import { toast } from "sonner"
import type { Thread } from "./types"

interface ThreadItemProps {
    thread: Thread
    isInFolder?: boolean
    onOpenRenameDialog?: (thread: Thread) => void
    onOpenMoveDialog?: (thread: Thread) => void
    onOpenDeleteDialog?: (thread: Thread) => void
}

export const ThreadItem = memo(
    ({
        thread,
        isInFolder = false,
        onOpenRenameDialog,
        onOpenMoveDialog,
        onOpenDeleteDialog
    }: ThreadItemProps) => {
        const [isMenuOpen, setIsMenuOpen] = useState(false)

        const togglePinMutation = useMutation(api.threads.togglePinThread)
        const params = useParams({ strict: false }) as { threadId?: string }
        const isActive = params.threadId === thread._id

        const handleTogglePin = async () => {
            const pinned = thread.pinned
            try {
                await togglePinMutation({ threadId: thread._id })
            } catch (error) {
                console.error("Failed to toggle pin:", error)
                toast.error(`Failed to ${pinned ? "unpin" : "pin"} thread`)
            }
        }

        const handleRename = () => {
            onOpenRenameDialog?.(thread)
        }

        const handleMove = () => {
            onOpenMoveDialog?.(thread)
        }

        const handleDelete = () => {
            onOpenDeleteDialog?.(thread)
        }

        return (
            <SidebarMenuItem className={isInFolder ? "pl-6" : ""}>
                <div
                    className={cn(
                        "group/item flex w-full items-center rounded-md",
                        "hover:bg-sidebar-accent",
                        isMenuOpen && "bg-sidebar-accent",
                        isActive && "bg-sidebar-accent text-foreground",
                        "h-8.5"
                    )}
                >
                    <SidebarMenuButton
                        asChild
                        className={cn(
                            "flex-1 hover:bg-transparent active:bg-transparent",
                            isActive && "text-foreground"
                        )}
                    >
                        <Link
                            to="/thread/$threadId"
                            params={{ threadId: thread._id }}
                            className="group/link relative flex w-full items-center overflow-hidden"
                        >
                            <span className="truncate pr-2">{thread.title}</span>

                            <div
                                className={cn(
                                    "absolute top-0 right-0 bottom-0 z-10 flex items-center",
                                    "transition-transform duration-100 ease-in-out",
                                    isMenuOpen
                                        ? "translate-x-0"
                                        : "translate-x-full group-hover/item:translate-x-0"
                                )}
                            >
                                <div
                                    className={cn(
                                        "pointer-events-none absolute top-0 right-full bottom-0 w-8",
                                        "bg-linear-to-l from-sidebar-accent to-transparent",
                                        isMenuOpen
                                            ? "opacity-100"
                                            : "opacity-0 group-hover/item:opacity-100"
                                    )}
                                />

                                <div className="flex h-full items-center gap-0.5 bg-sidebar-accent pr-2 pl-1">
                                    <button
                                        type="button"
                                        aria-label={`Delete ${thread.title}`}
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleDelete()
                                        }}
                                        className={cn(
                                            "flex h-6 w-6 items-center justify-center rounded-md",
                                            "text-muted-foreground hover:bg-sidebar-accent-foreground/10 hover:text-destructive",
                                            "transition-colors"
                                        )}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>

                                    <DropdownMenu onOpenChange={setIsMenuOpen}>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={(e) => e.preventDefault()}
                                                className={cn(
                                                    "flex h-6 w-6 items-center justify-center rounded-md",
                                                    "text-muted-foreground hover:bg-sidebar-accent-foreground/10 hover:text-foreground",
                                                    "transition-colors",
                                                    isMenuOpen &&
                                                        "bg-sidebar-accent-foreground/10 text-foreground"
                                                )}
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={handleRename}>
                                                <Edit3 className="mr-2 h-4 w-4" />
                                                Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={handleTogglePin}>
                                                <Pin className="mr-2 h-4 w-4" />
                                                {thread.pinned ? "Unpin" : "Pin"}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={handleMove}>
                                                <FolderOpen className="mr-2 h-4 w-4" />
                                                Move to folder
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={handleDelete}
                                                variant="destructive"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </Link>
                    </SidebarMenuButton>
                </div>
            </SidebarMenuItem>
        )
    },
    (prevProps, nextProps) => {
        return (
            equal(prevProps.thread, nextProps.thread) &&
            prevProps.isInFolder === nextProps.isInFolder
        )
    }
)

ThreadItem.displayName = "ThreadItem"

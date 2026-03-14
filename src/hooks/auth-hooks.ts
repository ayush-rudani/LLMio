import { authClient } from "@/lib/auth-client"
import { createAuthHooks } from "@daveyplate/better-auth-tanstack"
import { useQuery } from "@tanstack/react-query"

export const authHooks = createAuthHooks(authClient)

export const {
    useSession,
    usePrefetchSession,
    useListAccounts,
    useListSessions,
    useListDeviceSessions,
    useListPasskeys,
    useUpdateUser,
    useUnlinkAccount,
    useRevokeOtherSessions,
    useRevokeSession,
    useRevokeSessions,
    useSetActiveSession,
    useRevokeDeviceSession,
    useDeletePasskey,
    useAuthQuery,
    useAuthMutation
} = authHooks

// Custom useToken hook that uses Convex better-auth token endpoint
export function useToken(options?: { initialData?: () => { token: string } | undefined }) {
    const { data: session } = useSession()

    const query = useQuery({
        queryKey: ["convex-auth-token", session?.session?.id],
        queryFn: async () => {
            // Call the Convex token endpoint directly
            const result = await authClient.$fetch<{ token: string }>("/convex/token", {
                method: "GET"
            })
            return result.data
        },
        enabled: !!session?.session?.id,
        staleTime: 1000 * 60 * 4, // 4 minutes (tokens typically expire in 5)
        initialData: options?.initialData?.()
    })

    return {
        token: query.data?.token ?? null,
        isPending: query.isPending,
        isLoading: query.isLoading,
        refetch: query.refetch
    }
}

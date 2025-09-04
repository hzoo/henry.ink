import { useQuery } from "@tanstack/react-query";
import type { StoredMark } from "@/api/trails/trail-storage";

/**
 * Hook to fetch mark previews for a trail
 * Returns loading state and the first few marks for preview
 * Uses the existing /api/trails/:uri endpoint with limit parameter
 */
export function useTrailMarkPreviews(trailUri: string | null, limit = 5) {
  return useQuery({
    queryKey: ["trail-mark-previews", trailUri, limit],
    queryFn: async (): Promise<StoredMark[]> => {
      if (!trailUri) throw new Error("Trail URI is required");
      
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: "0",
      });
      
      const response = await fetch(`/api/trails/${encodeURIComponent(trailUri)}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch mark previews: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.marks || []; // Extract marks array from the response
    },
    enabled: !!trailUri,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
import { ArenaChannelList } from "@/src/components/ArenaChannelList";
import { ArenaChannelDetail } from "@/src/components/ArenaChannelDetail";
import { arenaUrlState } from "@/src/lib/arena-navigation";

/**
 * Simple router for Arena components based on URL state
 * Each component is self-contained and fetches its own data
 */
export function ArenaSidebar() {
  const urlState = arenaUrlState.value;

  return (
    <div className="flex-1 flex flex-col h-full relative">
      {/* Route based on URL state */}
      {urlState.channelSlug ? (
        <ArenaChannelDetail channelSlug={urlState.channelSlug} />
      ) : (
        <ArenaChannelList />
      )}
    </div>
  );
}

import { ArenaChannelList } from "@/src/components/ArenaChannelList";
import { ArenaChannelView } from "@/src/components/ArenaChannelView";
import { BlockViewerOverlay } from "@/src/components/BlockViewerOverlay";
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
        <ArenaChannelView channelSlug={urlState.channelSlug} />
      ) : (
        <ArenaChannelList />
      )}

      {/* Block viewer overlay - rendered globally based on URL state */}
      <BlockViewerOverlay />
    </div>
  );
}
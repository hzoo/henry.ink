import type { AppBskyFeedDefs } from "@atcute/bluesky";
import type { Signal } from "@preact/signals";
import type { PostFilter } from "./postFilters";

export interface ThreadReply {
  post: AppBskyFeedDefs.PostView;
  replies?: ThreadReply[];
}

export interface PostRepliesProps {
  replies: ThreadReply[] | null;
  isExpanded: Signal<boolean>;
  depth?: number;
  op?: string;
  filters?: PostFilter[];
}
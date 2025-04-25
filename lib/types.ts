import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import type { Signal } from "@preact/signals";

export interface ThreadReply {
  post: AppBskyFeedDefs.PostView;
  replies?: ThreadReply[];
}

export interface PostRepliesProps {
  post: AppBskyFeedDefs.PostView;
  isExpanded: Signal<boolean>;
  depth?: number;
  maxDepth?: number;
  prefetchedReplies?: ThreadReply[];
  op?: string;
}
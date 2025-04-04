import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import type { Signal } from "@preact/signals";

export interface ThreadReply {
  post: PostView;
  replies?: ThreadReply[];
}

export interface PostRepliesProps {
  post: PostView;
  isExpanded: Signal<boolean>;
  depth?: number;
  maxDepth?: number;
  prefetchedReplies?: ThreadReply[];
}
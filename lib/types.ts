import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import type { Signal } from "@preact/signals";

export interface ThreadReply {
  post: AppBskyFeedDefs.PostView;
  replies?: ThreadReply[];
}

export interface PostRepliesProps {
  replies: ThreadReply[] | null;
  isExpanded: Signal<boolean>;
  depth?: number;
  op?: string;
}
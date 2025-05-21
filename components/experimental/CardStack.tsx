import { useSignal } from "@preact/signals-react/runtime";
import { useComputed } from "@preact/signals";
import { useEffect, useRef } from "react";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { PostText } from "@/components/post/PostText";
import { PostEmbed } from "@/components/post/PostEmbed";
import { Icon } from "@/components/Icon";
import type { ThreadReply } from "@/lib/types";
import type { DisplayableItem } from "@/components/post/FullPost";
import { getTimeAgo } from "@/lib/utils/time";
import { formatCount } from "@/lib/utils/count";

/* helper for full timestamp in main card */
const formatFullDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
    year: "numeric",
  });

interface CardStackProps {
  threadData: {
    post: AppBskyFeedDefs.PostView;
    replies: ThreadReply[];
  };
  displayItems: DisplayableItem[];
}

interface ThreadNode {
  post: AppBskyFeedDefs.PostView;
  children: ThreadNode[];
  parent: ThreadNode | null;
  descendantCount: number;
}

export function CardStack({ threadData, displayItems }: CardStackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const root = useComputed<ThreadNode | null>(() => {
    if (!threadData?.post) return null;

    function build(
      node: AppBskyFeedDefs.PostView,
      replies?: ThreadReply[],
      parent: ThreadNode | null = null,
    ): ThreadNode {
      const res: ThreadNode = {
        post: node,
        children: [],
        parent,
        descendantCount: 0,
      };
      if (replies) {
        for (const r of replies) {
          const child = build(r.post, r.replies, res);
          res.children.push(child);
          res.descendantCount += child.descendantCount + 1;
        }
      }
      return res;
    }

    return build(threadData.post, threadData.replies);
  });

  const stack = useSignal<ThreadNode[]>([]);
  const focusIdx = useSignal(0); // highlighted preview-row
  const hasNav = useSignal(false); // show highlight only after kb-nav
  /** remembers the last selection for every card we've already seen */
  const memo = useRef<WeakMap<ThreadNode, number>>(new WeakMap());
  const showKeyboard = useSignal(false);

  /* ——————————————————————————————————————————————————————————————— helpers ——————————————————————————————————— */
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const getThumb = (n: ThreadNode): string | null => {
    const e: any = n.post.embed;
    if (!e) return null;
    switch (e.$type) {
      case "app.bsky.embed.images#view":
        return e.images?.[0]?.thumb ?? null;
      case "app.bsky.embed.external#view":
        return e.external?.thumb ?? null;
      case "app.bsky.embed.recordWithMedia#view":
        return e.media?.images?.[0]?.thumb ?? null;
      default:
        return null;
    }
  };

  if (root.value && stack.value.length === 0) {
    stack.value = [root.value];
  }

  const openNode = (node: ThreadNode) => {
    const current = stack.value[stack.value.length - 1];
    memo.current.set(current, focusIdx.value); // remember!

    stack.value = [...stack.value, node];
    focusIdx.value = memo.current.get(node) ?? 0; // restore (or 0)
    hasNav.value = false; // clear highlight on click-open
  };

  const goBack = () => {
    if (stack.value.length > 1) {
      const exiting = stack.value[stack.value.length - 1];
      memo.current.set(exiting, focusIdx.value); // remember!

      const newStack = stack.value.slice(0, -1);
      stack.value = newStack;

      const newTop = newStack[newStack.length - 1];
      focusIdx.value = memo.current.get(newTop) ?? 0; // restore
    }
  };

  /* ——————————————————————————————————————————————————————————— keyboard nav —————————————————————————————————— */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    /* reset highlight on any click/tap inside the stack */
    const handleClick = () => (hasNav.value = false);
    el.addEventListener("click", handleClick);

    const handleKeyDown = (e: KeyboardEvent) => {
      showKeyboard.value = true;
      const current = stack.value[stack.value.length - 1];
      if (!current) return;

      switch (e.key) {
        /* ⇧ / k – previous row (no wrap) */
        case "ArrowUp":
        case "k": {
          e.preventDefault();
          if (current.children.length === 0) break;
          const idx = clamp(focusIdx.value - 1, 0, current.children.length - 1);
          focusIdx.value = idx;
          memo.current.set(current, idx);
          hasNav.value = true;
          break;
        }
        /* ⇩ / j – next row (no wrap) */
        case "ArrowDown":
        case "j": {
          e.preventDefault();
          if (current.children.length === 0) break;
          const idx = clamp(focusIdx.value + 1, 0, current.children.length - 1);
          focusIdx.value = idx;
          memo.current.set(current, idx);
          hasNav.value = true;
          break;
        }
        /* ⇨ / l – open focused child */
        case "ArrowRight":
        case "l": {
          e.preventDefault();
          if (current.children[focusIdx.value]) {
            openNode(current.children[focusIdx.value]);
          }
          hasNav.value = true;
          break;
        }
        /* ⇦ / h / esc – back */
        case "ArrowLeft":
        case "h":
        case "Escape":
          e.preventDefault();
          goBack();
          break;
      }
    };

    el.addEventListener("keydown", handleKeyDown);
    /* focus as soon as the component mounts so keys work immediately */
    requestAnimationFrame(() => el.focus({ preventScroll: true }));
    return () => {
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("click", handleClick);
    };
  }, []);

  /* ——————————————————————————————————————————— ensure row stays visible ————————————————————————————————— */
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [focusIdx.value, stack.value.length]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`relative h-[70vh] w-full max-w-md mx-auto focus:outline-none ${showKeyboard.value ? "focus-visible:ring-2 focus-visible:ring-blue-500" : ""}`}
    >
      <div className="p-2 text-xs text-gray-500 flex gap-3">
        <div>
          <kbd className="px-1">↑/k</kbd> <kbd className="px-1">↓</kbd> select
        </div>
        <div>
          <kbd className="px-1">→/j</kbd> open
        </div>
        <div>
          <kbd className="px-1">←/h</kbd> or <kbd className="px-1">esc</kbd>{" "}
          back
        </div>
      </div>
      {stack.value.map((node, idx) => {
        const offset = (idx - stack.value.length + 1) * 16;
        const isTop = idx === stack.value.length - 1;
        return (
          <div
            key={idx}
            className="absolute inset-0 transition-transform"
            style={{ transform: `translateX(${offset}px)` }}
          >
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md h-full overflow-y-auto">
              <div className="p-2 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
                <button
                  onClick={goBack}
                  disabled={stack.value.length === 1}
                  className="p-1 disabled:opacity-30"
                >
                  <Icon name="arrowUturnLeft" className="size-4" />
                </button>
                <div className="text-xs text-gray-500">
                  {getTimeAgo(node.post.indexedAt)}
                </div>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {displayItems.includes("avatar") &&
                    node.post.author.avatar && (
                      <img
                        src={node.post.author.avatar}
                        className="w-8 h-8 rounded-full"
                        alt={node.post.author.handle}
                      />
                    )}
                  <div className="flex flex-col">
                    {displayItems.includes("displayName") && (
                      <span className="font-medium text-sm">
                        {node.post.author.displayName ||
                          node.post.author.handle}
                      </span>
                    )}
                    {displayItems.includes("handle") && (
                      <span className="text-xs text-gray-500">
                        @{node.post.author.handle}
                      </span>
                    )}
                  </div>
                </div>
                <div className="prose prose-sm dark:prose-invert break-words">
                  <PostText post={node.post} />
                </div>
                <PostEmbed post={node.post} />
                {/* —— post stats: reposts first, likes second —— */}
                <div className="flex gap-4 text-xs text-gray-600 mt-1">
                  <div className="flex items-center gap-1">
                    <Icon name="arrowPath" className="size-3.5" />
                    {formatCount(node.post.repostCount ?? 0)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon name="heart" className="size-3.5" />
                    {formatCount(node.post.likeCount ?? 0)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon name="comment" className="size-3.5" />
                    {formatCount(node.post.replyCount ?? 0)}
                  </div>
                </div>

                {/* full timestamp just above metrics */}
                <div className="text-xs text-gray-500 mt-3">
                  {formatFullDate(node.post.indexedAt)}
                </div>
              </div>
              {node.children.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1">
                  {node.children.map((child, cidx) => (
                    <button
                      key={cidx}
                      onClick={() => openNode(child)}
                      ref={
                        isTop && focusIdx.value === cidx
                          ? selectedRowRef
                          : undefined
                      }
                      className={`group relative flex items-start gap-2 w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        isTop &&
                        focusIdx.value === cidx &&
                        hasNav.value /* ← highlight only after kb-nav */
                          ? "bg-blue-50 dark:bg-blue-950"
                          : ""
                      }`}
                    >
                      {/* Avatar replaces chevron */}
                      {displayItems.includes("avatar") &&
                        child.post.author.avatar && (
                          <img
                            src={child.post.author.avatar}
                            alt={child.post.author.handle}
                            className="w-6 h-6 rounded-full flex-shrink-0"
                          />
                        )}

                      <div className="flex flex-col flex-1 min-w-0">
                        {/* ───── header line: name  handle  •  time ───── */}
                        <div className="flex items-center gap-1 text-xs min-w-0">
                          {/* display-name (shrinks / ellipsis first) */}
                          <span className="font-medium truncate min-w-0 max-w-[55%]">
                            {displayItems.includes("displayName")
                              ? child.post.author.displayName ||
                                child.post.author.handle
                              : child.post.author.handle}
                          </span>
                          {/* handle (shrinks second) */}
                          {displayItems.includes("handle") && (
                            <span className="text-gray-500 truncate min-w-0 max-w-[35%]">
                              @{child.post.author.handle}
                            </span>
                          )}
                          {/* bullet + relative time (never shrinks) */}
                          <span className="text-gray-400 flex-shrink-0">•</span>
                          <span className="text-gray-500 flex-shrink-0">
                            {getTimeAgo(child.post.indexedAt)}
                          </span>
                        </div>
                        <span className="text-[11px] line-clamp-2">
                          <PostText post={child.post} />
                        </span>
                      </div>

                      {/* thumbnail (image / link) */}
                      {getThumb(child) ? (
                        <img
                          src={getThumb(child)!}
                          className="w-8 h-8 rounded object-cover"
                          alt=""
                        />
                      ) : child.post.embed ? (
                        <Icon name="link" className="size-4 text-gray-400" />
                      ) : null}

                      {/* engagement counters: reposts → likes */}
                      <div className="flex items-center gap-2 text-xs ml-auto">
                        {/* reposts: hidden at 0 until hover */}
                        <div
                          className={`flex items-center gap-1 ${
                            child.post.repostCount === 0
                              ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                              : ""
                          }`}
                        >
                          <Icon name="arrowPath" className="size-3.5" />
                          {formatCount(child.post.repostCount ?? 0)}
                        </div>
                        {/* likes: always visible, even at 0 */}
                        <div className="flex items-center gap-1">
                          <Icon name="heart" className="size-3.5" />
                          {formatCount(child.post.likeCount ?? 0)}
                        </div>
                      </div>

                      {/* ↓ replies counter moved to bottom-right */}
                      {child.descendantCount > 0 && (
                        <span className="absolute bottom-1.5 right-2 text-[10px] text-gray-500">
                          +{child.descendantCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

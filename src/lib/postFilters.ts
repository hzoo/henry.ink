import type { AppBskyFeedDefs } from "@atcute/bluesky";

export type PostFilter = (post: AppBskyFeedDefs.PostView) => boolean;

const bots = {
  "hacker news": 1,
  "hackernews": 1,
} as const;

export const Filters = {
  NoPins: (post: AppBskyFeedDefs.PostView): boolean => {
    if (post.record && typeof post.record === 'object' && 'text' in post.record) {
      const text = (post.record as { text: string }).text.trim();
      return text === "📌";
    }
    return false;
  },
  MaxTags: (maxTags: number) => (post: AppBskyFeedDefs.PostView): boolean => {
    if (post.record && typeof post.record === 'object' && 'text' in post.record) {
      const text = (post.record as { text: string }).text;
      const tags = text.match(/#\w+/g);
      return tags ? tags.length >= maxTags : false;
    }
    return false;
  },
  BotPost: (post: AppBskyFeedDefs.PostView): boolean => {
    const name = post.author.displayName?.toLowerCase() || "";

    if (post.record && typeof post.record === 'object' && 'text' in post.record) {
      if (name === "hn") {
        const text = (post.record as { text: string }).text;
        if (text.includes("https://news.ycombinator.com/")) {
          return true;
        }
      }
    }

    const botKeys = Object.keys(bots) as (keyof typeof bots)[];
    return botKeys.some(botKey => name.includes(botKey));
  },
};

export function applyFilters(post: AppBskyFeedDefs.PostView, filters?: PostFilter[]): boolean {
  if (!filters || filters.length === 0) {
    return false;
  }
  for (const filter of filters) {
    if (filter(post)) {
      return true;
    }
  }
  return false;
}

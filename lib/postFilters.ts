import type { AppBskyFeedDefs } from "@atcute/client/lexicons";

export type PostFilter = (post: AppBskyFeedDefs.PostView) => boolean;

export const Filters = {
  NoPins: (post: AppBskyFeedDefs.PostView): boolean => {
    if (post.record && typeof post.record === 'object' && 'text' in post.record) {
      const text = (post.record as { text: string }).text.trim();
      return text === "📌";
    }
    return false;
  },
  MinLikeCount: (minLikes: number) => (post: AppBskyFeedDefs.PostView): boolean => {
    return (post.likeCount || 0) < minLikes;
  },
  MinCharacterCount: (minChars: number) => (post: AppBskyFeedDefs.PostView): boolean => {
    if (post.record && typeof post.record === 'object' && 'text' in post.record) {
      const text = (post.record as { text: string }).text;
      return text.length < minChars;
    }
    return false;
  },
  TextContains: (searchText: string | string[]) => (post: AppBskyFeedDefs.PostView): boolean => {
    if (post.record && typeof post.record === 'object' && 'text' in post.record) {
      const text = (post.record as { text: string }).text.toLowerCase();
      const searchTerms = Array.isArray(searchText) ? searchText.map(s => s.toLowerCase()) : [searchText.toLowerCase()];
      return searchTerms.some(term => text.includes(term));
    }
    return false;
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
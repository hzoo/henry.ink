interface ArticleMetadata {
  url: string;
  title?: string;
  content?: string;
}

export function pageMetadata(url: string, article?: ArticleMetadata) {
  const target = new URL(url);
  const matches = article && new URL(article.url).href === target.href;
  return {
    title: (matches && article.title?.trim() || target.hostname).slice(0, 300),
    description: matches ? (article.content || '').replace(/\s+/g, ' ').trim().slice(0, 240) : '',
  };
}

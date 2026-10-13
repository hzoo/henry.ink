import type { EmbedContent, EmbedProviderId } from "@/henry-ink/signals";

export interface EmbedProvider {
  id: EmbedProviderId;
  matches: (url: string) => boolean;
  normalize?: (url: string) => string;
  createContent: (url: string) => EmbedContent;
}

const providers: EmbedProvider[] = [];

export function registerEmbedProvider(provider: EmbedProvider) {
  providers.push(provider);
}

export function resolveEmbedProvider(url: string): EmbedProvider | undefined {
  return providers.find((provider) => provider.matches(url));
}

export function normalizeWithProvider(provider: EmbedProvider, url: string): string {
  return provider.normalize ? provider.normalize(url) : url;
}

export function listEmbedProviders() {
  return providers.slice();
}

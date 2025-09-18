import type { EmbedContent, EmbedProviderId } from "@/henry-ink/signals";

export interface EmbedProviderContext {
  fetch: typeof fetch;
  env: {
    youtubeWorkerUrl?: string;
  };
}

export interface EmbedProvider {
  id: EmbedProviderId;
  matches: (url: string) => boolean;
  normalize?: (url: string) => string;
  fetchContent: (url: string, context: EmbedProviderContext) => Promise<EmbedContent>;
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

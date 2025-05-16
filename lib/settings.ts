import { signal } from "@preact/signals";
import { signalBrowserLocal, signalBrowserSync } from "./signal";

// Theme signal
export const isDarkMode = signal<boolean>(window.matchMedia('(prefers-color-scheme: dark)').matches);
// Settings signal
export const autoFetchEnabled = signalBrowserSync<boolean>('autoFetchEnabled', true);
export const whitelistedDomains = signalBrowserLocal<string[]>('whitelistedDomains', []);
export const showQuotePopupOnSelection = signalBrowserSync<boolean>('showQuotePopupOnSelection', true);

export async function addDomainToWhitelist(domain: string) {
  const currentDomains = whitelistedDomains.value;
  if (!currentDomains.includes(domain)) {
    whitelistedDomains.value = [...currentDomains, domain];
  }
}

export async function removeDomainFromWhitelist(domain: string) {
  const currentDomains = whitelistedDomains.value;
  if (currentDomains.includes(domain)) {
    whitelistedDomains.value = currentDomains.filter(d => d !== domain);
  }
}
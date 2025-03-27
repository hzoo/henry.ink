import { signal } from "@preact/signals";

// Theme signal
export const isDarkMode = signal<boolean>(window.matchMedia('(prefers-color-scheme: dark)').matches);

// Settings signal
export const autoFetchEnabled = signal<boolean>(true); // Default to true for auto-fetch

// Type for our settings
interface ExtensionSettings {
  autoFetchEnabled: boolean;
}

// Load settings from storage
export async function loadSettings(): Promise<void> {
  try {
    const result = await browser.storage.sync.get({
      autoFetchEnabled: true, // Default value
    });
    
    autoFetchEnabled.value = result.autoFetchEnabled;
    console.log("Settings loaded:", { autoFetchEnabled: autoFetchEnabled.value });
  } catch (err) {
    console.error("Error loading settings:", err);
  }
}

// Save a specific setting
export async function saveSetting<K extends keyof ExtensionSettings>(
  key: K, 
  value: ExtensionSettings[K]
): Promise<void> {
  try {
    await browser.storage.sync.set({ [key]: value });
    console.log(`Setting saved: ${key}:`, value);
  } catch (err) {
    console.error(`Error saving setting ${key}:`, err);
  }
}

// Toggle auto fetch and save the setting
export async function toggleAutoFetch(): Promise<void> {
  autoFetchEnabled.value = !autoFetchEnabled.value;
  await saveSetting("autoFetchEnabled", autoFetchEnabled.value);
}

// Toggle theme and update HTML class
export function toggleTheme(): void {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.classList.toggle('dark', isDarkMode.value);
}

export const whitelistedDomains = signal<string[]>([]);

export function extractBaseDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname;
  } catch {
    return "";
  }
}

export async function addDomainToWhitelist(domain: string) {
  const currentDomains = whitelistedDomains.value;
  if (!currentDomains.includes(domain)) {
    whitelistedDomains.value = [...currentDomains, domain];
    await chrome.storage.local.set({ whitelistedDomains: whitelistedDomains.value });
  }
}

export async function removeDomainFromWhitelist(domain: string) {
  const currentDomains = whitelistedDomains.value;
  if (currentDomains.includes(domain)) {
    whitelistedDomains.value = currentDomains.filter(d => d !== domain);
    await chrome.storage.local.set({ whitelistedDomains: whitelistedDomains.value });
  }
}

export function isDomainWhitelisted(domain: string): boolean {
  return whitelistedDomains.value.includes(domain);
}

export function getAllWhitelistedDomains(): string[] {
  return [...whitelistedDomains.value].sort();
}

// Initialize whitelist from storage
chrome.storage.local.get(['whitelistedDomains']).then((result) => {
  if (result.whitelistedDomains) {
    whitelistedDomains.value = result.whitelistedDomains;
  }
}); 
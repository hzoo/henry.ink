import { signal } from "@preact/signals";
import { signalBrowserLocal, signalBrowserSync } from "./signal";

export type DomainStatus = 'a' | 'b';

// Theme signal
export const isDarkMode = signal<boolean>(window.matchMedia('(prefers-color-scheme: dark)').matches);
// Settings signal
export const autoFetchEnabled = signalBrowserSync<boolean>('autoFetchEnabled', true);
export const domainSettings = signalBrowserLocal<{[domain: string]: DomainStatus}>('domainSettings', {});
export const showQuotePopupOnSelection = signalBrowserSync<boolean>('showQuotePopupOnSelection', true);

export async function setDomainStatus(domain: string, status: DomainStatus | null) {
  const currentSettings = { ...domainSettings.value }; // Clone the object
  if (status === null) {
    delete currentSettings[domain];
  } else {
    currentSettings[domain] = status;
  }
  domainSettings.value = currentSettings;
}

// --- Migration Logic ---
async function migrateSettings() {
  if (typeof browser === 'undefined' || !browser.storage?.local) {
    return;
  }

  const oldKey = 'whitelistedDomains';
  const newKey = 'domainSettings';

  try {
    const data = await browser.storage.local.get([oldKey, newKey]);
    const oldDomains = data[oldKey] as string[] | undefined;
    const newSettings = data[newKey] as {[domain: string]: DomainStatus} | undefined;

    if (oldDomains && Array.isArray(oldDomains)) {
      let migratedSettings: {[domain: string]: DomainStatus} = {};

      if (newSettings) {
        migratedSettings = { ...newSettings };
      }

      oldDomains.forEach(domain => {
        if (!(domain in migratedSettings)) {
          migratedSettings[domain] = 'a';
        }
      });

      await browser.storage.local.set({ [newKey]: migratedSettings });
      await browser.storage.local.remove(oldKey);
      domainSettings.value = migratedSettings;

    }
  } catch (error) {
    console.error("Error during settings migration:", error);
  }
}

// Run the migration function on load
migrateSettings();
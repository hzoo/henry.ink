import { signal } from "@preact/signals";

export const inputValueSignal = signal("");
export const markdownContentSignal = signal<string | null>(null);
export const isLoadingSignal = signal(false);
export const errorSignal = signal<string | null>(null);

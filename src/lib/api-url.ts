import { resolveApiBase, resolveArchiveBase } from '@/src/lib/api-config';

export const apiBase = resolveApiBase(import.meta.env.VITE_API_URL, String(import.meta.env.PROD) === 'true');
export const archiveBase = resolveArchiveBase(import.meta.env.VITE_API_URL, String(import.meta.env.PROD) === 'true');

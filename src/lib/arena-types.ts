export interface ArenaPerson {
  name: string;
  slug: string;
}

export interface ArenaChannel {
  slug: string;
  title: string;
  visibility: 'public' | 'closed';
  description?: string;
  blockCount?: number;
  owner?: ArenaPerson;
}

export interface ArenaUrlBlock {
  id: number;
  title: string;
  kind: 'Link' | 'Text' | 'Image' | 'Media' | 'Attachment' | 'Block';
  sourceTitle?: string;
  previewUrl?: string;
  excerpt?: string;
  creator?: ArenaPerson;
  createdAt?: string;
  channels: { state: 'ready'; items: ArenaChannel[]; hasMore: boolean } | { state: 'error' };
}

export interface ArenaLookupPage {
  blocks: ArenaUrlBlock[];
  nextPage: number | null;
}

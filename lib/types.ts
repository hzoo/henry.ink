export interface BskyPost {
  uri: string;
  cid: string;
  record: {
    text: string;
    createdAt: string;
  };
  author: {
    did: string;
    handle: string;
    displayName?: string;
  };
  indexedAt: string;
}

export type ContentItem = BskyPost; 
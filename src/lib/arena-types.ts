/**
 * Shared types for Arena integration
 */

// Raw API response from Arena service
export interface ArenaApiMatch {
  slug: string;
  title: string;
  author_name: string;
  author_slug?: string;
  contents_count: number;
  updated_at?: string;
  bestMatch: {
    matchedText: string;
    position: number;
    endPosition: number;
  };
}

export interface ArenaApiResponse {
  matches: ArenaApiMatch[];
}

// Processed Arena match used in UI components
export interface ArenaMatch {
  slug: string;
  title: string;
  matchedText: string;
  context?: string; // Used by sidebar for preview text
  url: string;
  author_name: string;
  author_slug?: string;
  contents_count: number;
  updated_at?: string;
}

// Arena match with position data (for navigation)
export interface ArenaMatchWithPosition extends ArenaMatch {
  position: number;
  endPosition: number;
}

// Arena block types
export interface ResizedImage {
  src_1x: string;
  src_2x: string;
  width: number;
  height: number;
}

export interface ArenaBlockBase {
  id: number;
  title?: string;
  href: string;
  __typename: string;
}

export interface ImageBlock extends ArenaBlockBase {
  __typename: 'Image';
  resized_image?: {
    grid_cell_resized_image: ResizedImage;
  };
}

export interface TextBlock extends ArenaBlockBase {
  __typename: 'Text';
  content?: string;
}

export interface LinkBlock extends ArenaBlockBase {
  __typename: 'Link';
  source?: {
    url?: string;
  };
  resized_image?: {
    grid_cell_resized_image: ResizedImage;
  };
}

export interface EmbedBlock extends ArenaBlockBase {
  __typename: 'Embed';
  source?: {
    url?: string;
    provider_name?: string;
  };
  resized_image?: {
    grid_cell_resized_image: ResizedImage;
  };
}

export interface AttachmentBlock extends ArenaBlockBase {
  __typename: 'Attachment';
  file_content_type?: string;
  file_size?: number;
  file_extension?: string;
  resized_image?: {
    grid_cell_resized_image: ResizedImage;
  };
}

export type ArenaBlock = ImageBlock | TextBlock | LinkBlock | EmbedBlock | AttachmentBlock;

export interface ArenaChannelWithBlocks {
  id: number;
  slug: string;
  title: string;
  user: {
    name: string;
    slug: string;
  };
  length: number; // number of contents/blocks
  updated_at: string;
  blocks: ArenaBlock[];
}
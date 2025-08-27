/**
 * Arena API response types - simplified and practical
 * Focus on what we actually use rather than mapping every API field
 */

// Common normalized Arena Channel (used throughout the system)
export interface ArenaChannel {
  id: number;
  slug: string;
  title: string;
  updated_at: string;
  created_at: string;
  counts: {
    contents: number;
  };
  author_name?: string;
  author_slug?: string;
  visibility_name: string;
}

// Raw GraphQL search channel (before normalization)
export interface GraphQLRawChannel {
  id: number;
  slug: string;
  title: string;
  updated_at: string;
  created_at: string;
  counts: {
    contents: number;
  };
  visibility_name: string;
  user?: {
    name?: string;
    slug?: string;
  };
}

// GraphQL response that contains ssearch with raw channels
export interface GraphQLSearchResponse {
  data?: {
    ssearch?: GraphQLRawChannel[];
  };
  errors?: Array<{ 
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: {
      code: string;
      typeName?: string;
      fieldName?: string;
    };
  }>;
}

// GraphQL response that contains a single channel (raw, needs normalization)
export interface GraphQLChannelResponse {
  data?: {
    channel?: GraphQLRawChannel;
  };
  errors?: Array<{ 
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

// Arena User type (complete from actual API responses)
export interface ArenaUser {
  id: number;
  created_at: string;
  slug: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar: string;
  avatar_image: {
    thumb: string;
    display: string;
  };
  channel_count: number;
  following_count: number;
  profile_id: number;
  follower_count: number;
  initials: string;
  can_index: boolean;
  metadata: {
    description?: string | null;
  };
  is_premium: boolean;
  is_lifetime_premium: boolean;
  is_supporter: boolean;
  is_exceeding_connections_limit: boolean;
  is_confirmed: boolean;
  is_pending_reconfirmation: boolean;
  is_pending_confirmation: boolean;
  badge: string | null;
  base_class: 'User';
  class: 'User';
}

// REST API content item (blocks in channel contents)
export interface RESTContent {
  id: number;
  title?: string;
  updated_at: string;
  created_at: string;
  state: string;
  comment_count: number;
  generated_title?: string;
  content_html: string | null;
  description_html: string;
  visibility: string;
  content: string | null;
  description?: string;
  class: string; // 'Image', 'Link', 'Text', 'Media', 'Embed', 'Attachment'
  base_class: string; // Usually 'Block'
  source?: {
    url: string;
    title: string;
    provider: {
      name: string;
      url: string;
    };
  };
  image?: {
    filename: string;
    content_type: string;
    updated_at: string;
    thumb: { url: string };
    square: { url: string };
    display: { url: string };
    large: { url: string };
    original: {
      url: string;
      file_size: number;
      file_size_display: string;
    };
  };
  embed?: {
    url: string | null;
    type: string;
    title: string;
    author_name: string;
    author_url: string;
    source_url: string | null;
    thumbnail_url: string | null;
    width: number;
    height: number;
    html: string;
  };
  attachment: unknown | null;
  metadata: unknown;
  user: ArenaUser;
  position: number;
  selected: boolean;
  connection_id: number;
  connected_at: string;
  connected_by_user_id: number;
  connected_by_username: string;
  connected_by_user_slug: string;
  file_content_type?: string;
  file_size?: number;
  file_extension?: string;
}

// REST API collaborator
export interface RESTCollaborator {
  id: number;
  username: string;
  slug: string;
}

// REST API channel response with contents (from /v2/channels/{slug})
export interface RESTChannelResponse {
  id: number;
  slug: string;
  title: string;
  created_at: string;
  updated_at: string;
  added_to_at: string;
  published: boolean;
  open: boolean;
  collaboration: boolean;
  collaborator_count: number;
  length: number;
  kind: string;
  status: string;
  user_id: number;
  user?: {
    name?: string;
    username?: string;
    slug?: string;
  };
  contents?: RESTContent[];
  manifest?: {
    key: string;
    AWSAccessKeyId: string;
    bucket: string;
    success_action_status: string;
    policy: string;
    acl: string;
    signature: string;
    expires: string;
  };
  base_class: string;
  page: number;
  per: number;
  collaborators: RESTCollaborator[];
  follower_count: number;
  share_link: string | null;
  metadata: {
    description?: string | null;
  };
  class_name: string;
  can_index: boolean;
  'nsfw?': boolean;
  owner: ArenaUser;
}

// Arena Search Block (usually empty in channel searches)
export interface ArenaSearchBlock {
  id: number;
  title?: string;
  class: string;
}

// Arena Search User (usually empty in channel searches)
export interface ArenaSearchUser {
  id: number;
  slug: string;
  username: string;
}

// Arena Search Response (from /v2/search/channels)
export interface ArenaSearchResponse {
  term: string;
  per: number;
  current_page: number;
  total_pages: number;
  length: number;
  authenticated: boolean;
  channels: ArenaSearchChannel[];
  blocks: ArenaSearchBlock[]; // Usually empty for channel search
  users: ArenaSearchUser[]; // Usually empty for channel search
}

export interface ArenaSearchChannel {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  added_to_at: string;
  published: boolean;
  open: boolean;
  collaboration: boolean;
  collaborator_count: number;
  slug: string;
  length: number;
  kind: string;
  status: string;
  user_id: number;
  metadata: {
    description?: string | null;
  };
  contents: null; // Not included in search results
  share_link: null;
  follower_count: number;
  can_index: boolean;
  owner_type: string;
  owner_id: number;
  owner_slug: string;
  'nsfw?': boolean;
  state: string;
  user: ArenaUser;
  group: null;
  base_class: 'Channel';
  class: 'Channel';
}

// Alias for RESTChannelResponse - they are the same thing
export type ArenaChannelResponse = RESTChannelResponse;

// Alias for RESTContent - they are the same thing 
export type ArenaContent = RESTContent;

// GraphQL Response wrapper (for search mutations)
export interface ArenaGraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: {
      code: string;
      typeName?: string;
      fieldName?: string;
    };
  }>;
}

// GraphQL Search Response data
export interface ArenaGraphQLSearchData {
  ssearch?: GraphQLRawChannel[];
}
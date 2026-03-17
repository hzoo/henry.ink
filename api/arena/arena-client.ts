/**
 * Arena integration client
 * Handles fetching and normalizing channel data for the matcher and sidebar.
 */

import type { 
  ArenaChannel, 
  GraphQLRawChannel,
  ArenaGraphQLSearchData,
  RESTChannelResponse,
  RESTContent
} from './arena-api-types';
import type { ArenaBlock } from '../../src/lib/arena-types';
import { arenaFetchJson, arenaGraphql } from './arena-api';

export interface FetchChannelsOptions {
  per?: number;
  page?: number;
  minContents?: number;
  maxChannels?: number;
  delayMs?: number;
  startPage?: number;
  onProgress?: (current: number, total?: number) => void;
  onPageSaved?: (page: number, channels: number) => void;
  onPageFetched?: (channels: ArenaChannel[]) => Promise<void>;
}

export interface FetchChannelsResult {
  channels: ArenaChannel[];
  hasMore: boolean;
  totalFetched: number;
}

const CHANNELS_QUERY = `
  query Channels($per: Int!, $page: Int!, $q: String!) {
    ssearch(
      per: $per,
      page: $page,
      q: $q,
      type: [CHANNEL]
      sort_by: CREATED_AT
      direction: ASC
    ) {
      ... on Channel {
        id
        slug
        title
        updated_at
        created_at
        counts {
          contents
        }
        user {
          slug
          name
        }
        visibility_name
      }
    }
  }
`;
export class ArenaClient {
  async fetchChannels(options: FetchChannelsOptions = {}): Promise<FetchChannelsResult> {
    const {
      per = 100,
      page = 1,
      minContents = 1,
      onProgress
    } = options;

    const requestBody = {
      query: CHANNELS_QUERY,
      variables: { per, page, q: "*" }
    };

    console.log(`🔍 Arena API Request - Page ${page}:`);
    console.log(`   Variables:`, JSON.stringify(requestBody.variables));
    const data = await arenaGraphql<ArenaGraphQLSearchData>(
      requestBody.query,
      requestBody.variables,
    );

    const allChannels = data.ssearch || [];
    
    
    // Filter channels with minimum content count  
    const filteredChannels = allChannels.filter((ch: GraphQLRawChannel) => 
      ch.counts.contents >= minContents
    );


    if (onProgress) {
      onProgress(page * per, undefined);
    }

    // Transform to our normalized format
    const normalizedChannels: ArenaChannel[] = filteredChannels.map((ch: GraphQLRawChannel) => ({
      id: ch.id,
      slug: ch.slug,
      title: ch.title,
      updated_at: ch.updated_at,
      created_at: ch.created_at,
      counts: {
        contents: ch.counts.contents || 0
      },
      author_name: ch.user?.name || ch.user?.slug || 'unknown',
      author_slug: ch.user?.slug,
      visibility_name: ch.visibility_name || 'PUBLIC'
    }));

    return {
      channels: normalizedChannels,
      hasMore: allChannels.length > 0, // If we got any results, assume there might be more
      totalFetched: page * per
    };
  }

  async fetchAllChannels(options: FetchChannelsOptions = {}): Promise<ArenaChannel[]> {
    const {
      per = 1000,
      minContents = 1,
      maxChannels = Infinity,
      delayMs = 3000,
      startPage = 1,
      onProgress,
      onPageSaved,
      onPageFetched
    } = options;

    const allChannels: ArenaChannel[] = [];
    let page = startPage;
    let consecutiveErrors = 0;

    console.log(`🚀 Fetching Arena channels (${per}/page, ${delayMs}ms delay, from page ${startPage})\n`);

    while (allChannels.length < maxChannels) {
      try {
        const result = await this.fetchChannels({ per, page, minContents, onProgress });

        if (result.channels.length === 0) {
          console.log('✅ No more channels - sync complete');
          break;
        }

        allChannels.push(...result.channels);
        consecutiveErrors = 0;

        const firstDate = result.channels[0]?.created_at.split('T')[0];
        const lastDate = result.channels[result.channels.length - 1]?.created_at.split('T')[0];
        console.log(`✅ Page ${page}: ${result.channels.length} channels (${allChannels.length} total) ${firstDate}-${lastDate}`);

        if (onPageFetched) await onPageFetched(result.channels);
        if (onPageSaved) onPageSaved(page, allChannels.length);
        if (onProgress) onProgress(allChannels.length, undefined);

        if (allChannels.length >= maxChannels) break;

        page++;
        if (result.channels.length > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (error: unknown) {
        if (error instanceof Error) {
          consecutiveErrors++;
          console.error(`❌ Page ${page} failed (${consecutiveErrors} consecutive errors):`, error);
          
          if (consecutiveErrors >= 5) {
            console.error(`💥 Too many errors, stopping at ${allChannels.length} channels`);
            break;
          }
          // Special handling for 500 errors (likely rate limiting)
          const errorMessage = error.message || '';
          const is500Error = errorMessage.includes('500');
          
          let backoffDelay = 0;
          if (is500Error) { 
            // For 500 errors, wait 1 minute to reset rate limit
            backoffDelay = 60000;
            console.log(`🚦 Rate limit hit, waiting 60 seconds to reset...`);
          } else {
            // Normal exponential backoff for other errors
            backoffDelay = Math.min(delayMs * Math.pow(2, consecutiveErrors), 30000);
          }
          
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    console.log(`\n🎉 Completed: ${allChannels.length} channels`);
    return allChannels;
  }


  /**
   * Fetch blocks for a specific channel using REST API
   */
  async fetchChannelBlocks(slug: string, per: number = 5, page: number = 1): Promise<import('../../src/lib/arena-types').ArenaChannelWithBlocks | null> {
    try {
      // Use REST API V2 to get channel with contents
      const restUrl = `https://api.are.na/v2/channels/${slug}?per=${per}&page=${page}`;
      
      const channelData = await arenaFetchJson<RESTChannelResponse>(restUrl);
      
      if (!channelData || !channelData.contents) {
        return null;
      }

      // Transform REST API response to our expected format
      const blocks = channelData.contents.map((content: RESTContent) => {
        const baseBlock = {
          id: content.id,
          title: content.title || content.generated_title || 'Untitled',
          href: `/block/${content.id}`,
          __typename: content.class || content.base_class
        };

        // Add type-specific fields
        switch (content.class) {
          case 'Image':
            return {
              ...baseBlock,
              __typename: 'Image',
              image_url: content.image?.original?.url, // CloudFront URL for fast loading
              resized_image: content.image ? {
                grid_cell_resized_image: {
                  src_1x: content.image.thumb?.url || content.image.square?.url || content.image.display?.url,
                  src_2x: content.image.display?.url || content.image.large?.url || content.image.square?.url,
                  // Fixed dimensions for consistent UI layout - Arena images are resized on-demand
                  width: 300,
                  height: 300
                }
              } : undefined
            };
          
          case 'Text':
            return {
              ...baseBlock,
              __typename: 'Text',
              content: content.content || content.description || ''
            };
          
          case 'Link':
            return {
              ...baseBlock,
              __typename: 'Link',
              image_url: content.image?.original?.url, // CloudFront URL for fast loading
              source: {
                url: content.source?.url
              },
              resized_image: content.image ? {
                grid_cell_resized_image: {
                  src_1x: content.image.thumb?.url || content.image.square?.url || content.image.display?.url,
                  src_2x: content.image.display?.url || content.image.large?.url || content.image.square?.url,
                  // Fixed dimensions for consistent UI layout - Arena images are resized on-demand
                  width: 300,
                  height: 300
                }
              } : undefined
            };
          
          case 'Media':
          case 'Embed':
            return {
              ...baseBlock,
              __typename: 'Embed',
              image_url: content.image?.original?.url, // CloudFront URL for fast loading
              source: {
                url: content.source?.url,
                provider_name: content.source?.provider?.name
              },
              resized_image: content.image ? {
                grid_cell_resized_image: {
                  src_1x: content.image.thumb?.url || content.image.square?.url || content.image.display?.url,
                  src_2x: content.image.display?.url || content.image.large?.url || content.image.square?.url,
                  // Fixed dimensions for consistent UI layout - Arena images are resized on-demand
                  width: 300,
                  height: 300
                }
              } : undefined
            };
          
          case 'Attachment':
            return {
              ...baseBlock,
              __typename: 'Attachment',
              image_url: content.image?.original?.url, // CloudFront URL for fast loading
              file_content_type: content.file_content_type,
              file_size: content.file_size,
              file_extension: content.file_extension,
              resized_image: content.image ? {
                grid_cell_resized_image: {
                  src_1x: content.image.thumb?.url || content.image.square?.url || content.image.display?.url,
                  src_2x: content.image.display?.url || content.image.large?.url || content.image.square?.url,
                  // Fixed dimensions for consistent UI layout - Arena images are resized on-demand
                  width: 300,
                  height: 300
                }
              } : undefined
            };
          
          default:
            return {
              ...baseBlock,
              __typename: 'Text',
              content: content.content || content.description || content.title || ''
            };
        }
      });

      return {
        id: channelData.id,
        slug: channelData.slug,
        title: channelData.title,
        user: {
          name: channelData.user?.name || channelData.user?.username || 'Unknown',
          slug: channelData.user?.slug || ''
        },
        length: channelData.length || channelData.contents?.length || 0,
        updated_at: channelData.updated_at,
        blocks: blocks as ArenaBlock[]
      };
    } catch (error) {
      console.error(`Error fetching blocks for channel ${slug}:`, error);
      return null;
    }
  }

  /**
   * Fetch single channel by ID for on-demand enrichment
   */
  async fetchChannelById(id: number): Promise<ArenaChannel | null> {
    const CHANNEL_QUERY = `
      query Channel($id: ID!) {
        channel(id: $id) {
          id
          slug
          title
          updated_at
          created_at
          counts {
            contents
          }
          user {
            slug
            name
          }
          visibility_name
        }
      }
    `;

    try {
      const data = await arenaGraphql<{ channel?: GraphQLRawChannel }>(
        CHANNEL_QUERY,
        { id },
      );

      const rawChannel = data.channel;
      if (!rawChannel) return null;
      
      // Normalize raw GraphQL response to ArenaChannel format
      const normalizedChannel: ArenaChannel = {
        id: rawChannel.id,
        slug: rawChannel.slug,
        title: rawChannel.title,
        updated_at: rawChannel.updated_at,
        created_at: rawChannel.created_at,
        counts: {
          contents: rawChannel.counts.contents || 0
        },
        author_name: rawChannel.user?.name || rawChannel.user?.slug || 'unknown',
        author_slug: rawChannel.user?.slug,
        visibility_name: rawChannel.visibility_name || 'PUBLIC'
      };
      
      return normalizedChannel;
    } catch (error) {
      console.error(`Error fetching channel ${id}:`, error);
      return null;
    }
  }
}

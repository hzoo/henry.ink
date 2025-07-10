#!/usr/bin/env bun

/**
 * Manual script to download and sync Arena V2 channels to SQLite database
 * Usage: bun henry-ink/scripts/sync-v2-channels.ts
 */

import { ArenaV2Client } from '../arena/arena-v2-client.ts';
import { ChannelStorage } from '../arena/channel-storage.ts';

async function main() {
  console.log('🏟️ Arena V2 Channel Sync Script');
  console.log('===============================\n');

  // Check for Arena tokens
  const appToken = process.env.VITE_ARENA_APP_TOKEN || process.env.ARENA_APP_TOKEN;
  const authToken = process.env.VITE_ARENA_AUTH_TOKEN;
  
  if (!appToken) {
    console.warn('⚠️  No Arena app token found in environment variables.');
    console.warn('   Set VITE_ARENA_APP_TOKEN or ARENA_APP_TOKEN for better rate limits.');
    console.warn('   Continuing without token (may hit rate limits)...\n');
  } else {
    console.log('✅ Arena app token found');
  }

  if (!authToken) {
    console.warn('⚠️  No Arena auth token found in environment variables.');
    console.warn('   Set VITE_ARENA_AUTH_TOKEN for full channel access.');
    console.warn('   Continuing without auth token (may have limited access)...\n');
  } else {
    console.log('✅ Arena auth token found');
  }

  // Initialize components
  const client = new ArenaV2Client();
  const storage = new ChannelStorage();

  // Get current stats
  const currentStats = storage.getStats();
  console.log('📊 Current Database Stats:');
  console.log(`   Total channels: ${currentStats.totalChannels}`);
  console.log(`   With content: ${currentStats.withContent}`);
  console.log(`   Quality channels (3+ blocks): ${currentStats.qualityChannels}`);
  console.log(`   Last sync: ${currentStats.lastSync || 'Never'}\n`);

  // Get last V2 sync progress and resume from next page
  const lastProgress = storage.getLastSyncProgress('v2');
  let startPage = 1;
  
  if (lastProgress) {
    const minutesAgo = Math.floor((Date.now() - new Date(lastProgress.timestamp).getTime()) / (1000 * 60));
    console.log(`📈 Found previous V2 sync from ${minutesAgo} minutes ago (page ${lastProgress.page}, ${lastProgress.totalChannels} channels)`);
    
    startPage = lastProgress.page + 1;
    console.log(`🔄 Auto-resuming V2 sync from page ${startPage}...\n`);
  }

  try {
    console.log('🚀 Starting Arena V2 channel sync...\n');

    const options = {
      per: 100,     // V2 API always returns 100 channels per page
      minContents: 1,
      maxChannels: 1_000_000,
      delayMs: 3_000,        // 3 seconds between requests
      startPage,            // Resume from where we left off
      
      onPageFetched: async (channels: any[]) => {
        await storage.storeChannels(channels);
      },
      
      onPageSaved: (page: number, channels: number) => {
        storage.saveSyncProgress('v2', page, channels);
      }
    };

    // Fetch all channels
    const channels = await client.fetchAllChannels(options);
    
    console.log(`\n✅ V2 Sync completed: ${channels.length} channels downloaded and stored`);

    // Final stats
    const finalStats = storage.getStats();
    console.log('\n📊 Final Database Stats:');
    console.log(`   Total channels: ${finalStats.totalChannels}`);
    console.log(`   With content: ${finalStats.withContent}`);
    console.log(`   Quality channels (3+ blocks): ${finalStats.qualityChannels}`);
    console.log(`   Last sync: ${finalStats.lastSync}\n`);

    // Quality breakdown
    const qualityBreakdown = getQualityBreakdown(storage);
    console.log('🎯 Quality Breakdown:');
    for (const { range, count } of qualityBreakdown) {
      console.log(`   ${range}: ${count} channels`);
    }

    console.log('\n🎉 V2 Sync completed successfully!');
    console.log('💡 You can now start the enhancement server:');
    console.log('   bun henry-ink/arena/server.ts');

  } catch (error) {
    console.error('\n❌ V2 Sync failed:', error);
    process.exit(1);
  } finally {
    storage.close();
  }
}

/**
 * Get quality breakdown of channels by content count
 */
function getQualityBreakdown(storage: ChannelStorage): Array<{ range: string; count: number }> {
  const queries = [
    { range: '1-2 blocks', query: 'SELECT COUNT(*) as count FROM channels WHERE contents_count >= 1 AND contents_count <= 2' },
    { range: '3-9 blocks', query: 'SELECT COUNT(*) as count FROM channels WHERE contents_count >= 3 AND contents_count <= 9' },
    { range: '10-49 blocks', query: 'SELECT COUNT(*) as count FROM channels WHERE contents_count >= 10 AND contents_count <= 49' },
    { range: '50-99 blocks', query: 'SELECT COUNT(*) as count FROM channels WHERE contents_count >= 50 AND contents_count <= 99' },
    { range: '100+ blocks', query: 'SELECT COUNT(*) as count FROM channels WHERE contents_count >= 100' },
  ];

  const breakdown: Array<{ range: string; count: number }> = [];
  
  for (const { range, query } of queries) {
    try {
      // Access private db property - this is a hack for the script
      const db = (storage as any).db;
      const result = db.prepare(query).get() as { count: number };
      breakdown.push({ range, count: result.count });
    } catch (error) {
      console.warn(`Warning: Could not get count for ${range}`);
      breakdown.push({ range, count: 0 });
    }
  }

  return breakdown;
}

// Run the script
if (import.meta.main) {
  main().catch(console.error);
}
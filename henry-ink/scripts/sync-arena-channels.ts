#!/usr/bin/env bun

/**
 * Manual script to download and sync Arena channels to SQLite database
 * Usage: bun henry-ink/scripts/sync-arena-channels.ts
 */

import { ArenaClient } from '../arena/arena-client.ts';
import { ChannelStorage } from '../arena/channel-storage.ts';


async function main() {
  console.log('🏟️ Arena Channel Sync Script');
  console.log('==============================\n');

  // Check for Arena app token
  const appToken = process.env.VITE_ARENA_APP_TOKEN || process.env.ARENA_APP_TOKEN;
  if (!appToken) {
    console.warn('⚠️  No Arena app token found in environment variables.');
    console.warn('   Set VITE_ARENA_APP_TOKEN or ARENA_APP_TOKEN for better rate limits.');
    console.warn('   Continuing without token (may hit rate limits)...\n');
  } else {
    console.log('✅ Arena app token found\n');
  }

  // Initialize components
  const client = new ArenaClient();
  const storage = new ChannelStorage();

  // Get current stats
  const currentStats = storage.getStats();
  console.log('📊 Current Database Stats:');
  console.log(`   Total channels: ${currentStats.totalChannels}`);
  console.log(`   With content: ${currentStats.withContent}`);
  console.log(`   Quality channels (3+ blocks): ${currentStats.qualityChannels}`);
  console.log(`   Last sync: ${currentStats.lastSync || 'Never'}\n`);

  // Get last sync progress and resume from next page
  const lastProgress = storage.getLastSyncProgress('graphql');
  let startPage = 1;
  
  if (lastProgress) {
    const minutesAgo = Math.floor((Date.now() - new Date(lastProgress.timestamp).getTime()) / (1000 * 60));
    console.log(`📈 Found previous sync from ${minutesAgo} minutes ago (page ${lastProgress.page}, ${lastProgress.totalChannels} channels)`);
    
    startPage = lastProgress.page + 1;
    console.log(`🔄 Auto-resuming from page ${startPage}...\n`);
  }

  try {
    console.log('🚀 Starting Arena channel sync...\n');

    const options = {
      per: 500,     // Larger batches for faster syncing
      minContents: 1,
      maxChannels: 1_000_000,
      delayMs: 5_000,        // 5 seconds between requests
      startPage,            // Resume from where we left off
      
      onPageFetched: async (channels: any[]) => {
        await storage.storeChannels(channels);
      },
      
      onPageSaved: (page: number, channels: number) => {
        storage.saveSyncProgress('graphql', page, channels);
      }
    };

    // Fetch all channels
    const channels = await client.fetchAllChannels(options);
    
    console.log(`\n✅ Sync completed: ${channels.length} channels downloaded and stored`);

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

    console.log('\n🎉 Sync completed successfully!');
    console.log('💡 You can now start the enhancement server:');
    console.log('   bun henry-ink/arena/server.ts');

  } catch (error) {
    console.error('\n❌ Sync failed:', error);
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
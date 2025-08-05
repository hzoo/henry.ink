#!/usr/bin/env bun

/**
 * Script to clean up Arena channels with only 1 block from the database
 * Run with: bun run henry-ink/arena/cleanup-single-block-channels.ts
 */

import { Database } from "bun:sqlite";
import path from "path";

// Use the same database path as the server
const dbPath = process.env.ARENA_DB_PATH || path.join(process.cwd(), 'henry-ink/arena/data/channels.db');

console.log(`🗄️  Opening database: ${dbPath}`);

try {
  const db = new Database(dbPath);
  
  // First, let's see how many channels we have with <= 1 block
  const countResult = db.query<{ count: number }, []>(
    "SELECT COUNT(*) as count FROM channels WHERE contents_count <= 1"
  ).get();
  
  const totalCount = countResult?.count || 0;
  
  if (totalCount === 0) {
    console.log("✅ No channels with 1 or fewer blocks found. Database is already clean!");
    process.exit(0);
  }
  
  console.log(`🔍 Found ${totalCount} channels with 1 or fewer blocks`);
  
  // Show a few examples before deletion
  const examples = db.query<{ slug: string, title: string, contents_count: number }, []>(
    "SELECT slug, title, contents_count FROM channels WHERE contents_count <= 1 LIMIT 5"
  ).all();
  
  console.log("\n📋 Examples of channels to be removed:");
  examples.forEach(ch => {
    console.log(`  - "${ch.title}" (${ch.slug}) - ${ch.contents_count} blocks`);
  });
  
  if (examples.length < totalCount) {
    console.log(`  ... and ${totalCount - examples.length} more`);
  }
  
  // Prompt for confirmation
  console.log("\n⚠️  This will permanently delete these channels from the database.");
  console.log("Press 'y' to continue or any other key to cancel: ");
  
  // Read user input
  const response = await new Promise<string>((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim().toLowerCase());
    });
  });
  
  // Close stdin to prevent hanging
  process.stdin.destroy();
  
  if (response !== 'y') {
    console.log("❌ Operation cancelled");
    process.exit(0);
  }
  
  // Delete channels with <= 1 block
  console.log("\n🗑️  Deleting channels...");
  
  const deleteResult = db.query("DELETE FROM channels WHERE contents_count <= 1").run();
  
  console.log(`✅ Successfully deleted ${deleteResult.changes} channels with 1 or fewer blocks`);
  
  // Show new count
  const newCountResult = db.query<{ count: number }, []>(
    "SELECT COUNT(*) as count FROM channels"
  ).get();
  
  console.log(`📊 Remaining channels in database: ${newCountResult?.count || 0}`);
  
  // Run VACUUM to reclaim space
  console.log("🧹 Optimizing database...");
  db.exec("VACUUM");
  
  console.log("✨ Cleanup complete!");
  
  // Explicitly exit to prevent hanging
  process.exit(0);
  
} catch (error) {
  console.error("❌ Error during cleanup:", error);
  process.exit(1);
}
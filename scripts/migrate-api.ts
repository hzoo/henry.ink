#!/usr/bin/env bun

/**
 * Migration script for API consolidation
 * Moves Arena database from old location to new API workspace
 * Run after: git pull && bun install
 */

import { existsSync, mkdirSync, copyFileSync, rmSync } from 'fs';
import { join } from 'path';

const oldDbPath = './henry-ink/arena/data/channels.db';
const newDbPath = './api/arena/data/channels.db';
const newDbDir = './api/arena/data';

console.log('🔄 Running API consolidation migration...');

// Check if migration is needed
if (!existsSync(oldDbPath)) {
  console.log('✅ No migration needed - old database not found');
  process.exit(0);
}

if (existsSync(newDbPath)) {
  console.log('✅ Migration already completed - new database exists');
  process.exit(0);
}

try {
  // Create new directory structure
  if (!existsSync(newDbDir)) {
    console.log('📁 Creating API directory structure...');
    mkdirSync(newDbDir, { recursive: true });
  }

  // Copy database file
  console.log('📋 Copying Arena database...');
  copyFileSync(oldDbPath, newDbPath);
  
  // Verify copy was successful
  if (existsSync(newDbPath)) {
    console.log('✅ Database successfully migrated to:', newDbPath);
    
    // Remove old directory structure
    console.log('🗑️  Cleaning up old arena directory...');
    rmSync('./henry-ink/arena', { recursive: true, force: true });
    
    console.log('✨ Migration completed successfully!');
  } else {
    throw new Error('Database copy verification failed');
  }

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
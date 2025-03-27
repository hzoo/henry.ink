#!/usr/bin/env bun
import { $, file } from "bun";

const version = process.argv[2];
if (!version) {
  console.error("Please provide a version number");
  process.exit(1);
}

async function createRelease() {
  try {
    console.log("🏗️ Building extension...");
    // Build for Chrome
    await $`bun run build`;
    await $`bun run zip`;
    
    console.log("📦 Creating GitHub release...");
    // Create a new release on GitHub
    await $`gh release create v${version} \
      --title "v${version}" \
      --notes "Release v${version}" \
      .output/extension-atproto-annotations-${version}-chrome.zip`;

    console.log("✅ Release created successfully!");
    return true;
  } catch (error) {
    console.error("\n❌ Release creation failed:", error);
    return false;
  }
}

// Allow running as script
if (import.meta.main) {
  const success = await createRelease();
  process.exit(success ? 0 : 1);
}

export { createRelease };

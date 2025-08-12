import { serve } from "bun";
import homepage from "./public/index.html";
import { createArchiveRoute, fontProxyRoute, archiveOptionsRoute } from "./routes";

// Development server for testing archive functionality
// Includes test HTML page on root route
const server = serve({
  development: true,
  port: 3002,
  
  routes: {
    // Test page (dev only)
    "/": homepage,

    // API routes
    "/api/font-proxy": {
      GET: fontProxyRoute
    },

    "/api/archive": {
      OPTIONS: archiveOptionsRoute,
      POST: createArchiveRoute
    }
  }
});

console.log(`🚀 Archive dev server running on ${server.url}`);
console.log(`📝 Test page available at ${server.url}`);
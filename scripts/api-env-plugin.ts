import { loadEnv, type Plugin } from 'vite';
import { resolveApiBase } from '../src/lib/api-config';

export function validateApiEnv(): Plugin {
  return {
    name: 'validate-api-env',
    configResolved(config) {
      if (config.command !== 'build') return;
      const env = loadEnv(config.mode, config.envDir);
      resolveApiBase(env.VITE_API_URL, true);
    },
  };
}

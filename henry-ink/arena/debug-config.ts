/**
 * Debug configuration for Arena enhancement system
 * Centralized control for logging levels and debug features
 */

export interface DebugConfig {
  logLevel: 'none' | 'minimal' | 'verbose';
  enableNormalizationDebug: boolean;
  enablePatternMatchingDebug: boolean;
  enablePerformanceTracking: boolean;
}

// Default configuration
const defaultConfig: DebugConfig = {
  logLevel: 'minimal',
  enableNormalizationDebug: false,
  enablePatternMatchingDebug: false,
  enablePerformanceTracking: true,
};

// Global debug config (can be modified at runtime)
let debugConfig: DebugConfig = { ...defaultConfig };

/**
 * Set debug configuration
 */
export function setDebugConfig(config: Partial<DebugConfig>): void {
  debugConfig = { ...debugConfig, ...config };
}

/**
 * Get current debug configuration
 */
export function getDebugConfig(): DebugConfig {
  return { ...debugConfig };
}

/**
 * Conditional logging based on log level
 */
export function debugLog(level: 'minimal' | 'verbose', message: string, ...args: any[]): void {
  if (debugConfig.logLevel === 'none') return;
  if (level === 'verbose' && debugConfig.logLevel !== 'verbose') return;
  
  console.log(message, ...args);
}

/**
 * Performance timing wrapper
 */
export function withTiming<T>(
  name: string, 
  fn: () => T,
  logLevel: 'minimal' | 'verbose' = 'minimal'
): T {
  if (!debugConfig.enablePerformanceTracking) {
    return fn();
  }
  
  const start = performance.now();
  const result = fn();
  const time = performance.now() - start;
  
  debugLog(logLevel, `${name}: ${time.toFixed(2)}ms`);
  
  return result;
}

/**
 * Enable development mode with verbose logging
 */
export function enableDevelopmentMode(): void {
  setDebugConfig({
    logLevel: 'verbose',
    enableNormalizationDebug: true,
    enablePatternMatchingDebug: true,
    enablePerformanceTracking: true,
  });
  
  console.log('🛠️ Arena debug: Development mode enabled');
}

/**
 * Enable production mode with minimal logging
 */
export function enableProductionMode(): void {
  setDebugConfig({
    logLevel: 'minimal',
    enableNormalizationDebug: false,
    enablePatternMatchingDebug: false,
    enablePerformanceTracking: false,
  });
  
  console.log('🏭 Arena debug: Production mode enabled');
}
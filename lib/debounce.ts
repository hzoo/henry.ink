/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * 
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns A debounced version of the original function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | undefined;
  
  return (...args: Parameters<T>): void => {
    const later = () => {
      timeout = undefined;
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait) as unknown as number;
  };
} 

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function debounceAsync<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout>;
  let resolveList: ((value: ReturnType<T>) => void)[] = [];

  const debounced = (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      resolveList.push(resolve);

      timeoutId = setTimeout(() => {
        const result = func(...args);
        if (result instanceof Promise) {
          result.then((res) => resolveList.forEach((r) => r(res)));
        } else {
          resolveList.forEach((r) => r(result as ReturnType<T>));
        }
        resolveList = [];
      }, wait);
    });
  };

  debounced.cancel = () => {
    clearTimeout(timeoutId);
    resolveList = [];
  };

  return debounced;
}
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function debounce<T extends (...args: any[]) => any>(
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
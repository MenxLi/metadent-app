/**
 * Runs an array of async tasks with a concurrency limit.
 *
 * @param tasks Array of functions that return promises.
 * @param maxConcurrent Maximum number of concurrent tasks.
 * @returns A promise that resolves to an array of results.
 */
export async function runWithLimit<T>(
    tasks: Array<() => Promise<T>>,
    maxConcurrent: number = 4,
): Promise<T[]> {
    const results: T[] = [];
    let currentIndex = 0;
    let activeCount = 0;
    const queue: (() => void)[] = [];

    async function runNext(): Promise<void> {
        if (currentIndex >= tasks.length) return;

        const taskIndex = currentIndex++;
        const task = tasks[taskIndex]!;

        if (activeCount >= maxConcurrent) {
            await new Promise<void>(resolve => queue.push(resolve));
        }

        activeCount++;
        try {
            const result = await task();
            results[taskIndex] = result;
        } finally {
            activeCount--;
            if (queue.length) {
                queue.shift()?.();
            }
            await runNext(); // continue with next task
        }
    }

    const initialTasks = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => runNext());
    await Promise.all(initialTasks);
    return results;
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}

export function to_snake_case_obj(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(to_snake_case_obj);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        newObj[snakeKey] = to_snake_case_obj(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

export function toCamelCaseObj(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCaseObj);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        newObj[camelKey] = toCamelCaseObj(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

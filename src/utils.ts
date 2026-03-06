/*
🧠 Ramer–Douglas–Peucker Algorithm (Simplification)
This algorithm recursively removes points that are within a certain distance (epsilon) from a straight line.

💡 Chaikin’s Algorithm (Smoothing)
This is a subdivision method that removes sharp corners and creates a more rounded curve by cutting corners.
*/

type Point = [number, number];

/**
 * Calculate perpendicular distance from point to line segment.
 */
function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }

  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(x - projX, y - projY);
}

/**
 * Ramer–Douglas–Peucker line simplification.
 */
function simplifyRDP(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;

  let maxDist = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i]!, points[0]!, points[points.length - 1]!);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyRDP(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  } else {
    return [points[0]!, points[points.length - 1]!];
  }
}

/**
 * Chaikin’s corner cutting algorithm (1 iteration).
 */
function chaikinSmoothing(points: Point[]): Point[] {
  const newPoints: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;

    const Q: Point = [0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1];
    const R: Point = [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1];

    newPoints.push(Q, R);
  }
  return newPoints;
}

/**
 * Resample contour using RDP + smoothing.
 */
export function resampleContour(
  contour: Point[],
  epsilon = 5e-3,
  smoothingIterations = 3
): Point[] {
  let simplified = simplifyRDP(contour, epsilon);
  for (let i = 0; i < smoothingIterations; i++) {
    simplified = chaikinSmoothing(simplified);
  }
  return simplified;
}

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

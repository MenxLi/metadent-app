type Point = [number, number];

type SimplificationNode = {
  index: number;
  point: Point;
  prev: SimplificationNode | null;
  next: SimplificationNode | null;
  error: number;
  removable: boolean;
};

const MIN_CONTOUR_POINTS = 3;
const DEFAULT_CORNER_ANGLE_THRESHOLD = (135 * Math.PI) / 180;

function squaredDistance(a: Point, b: Point): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function distance(a: Point, b: Point): number {
  return Math.sqrt(squaredDistance(a, b));
}

function triangleArea(prev: Point, current: Point, next: Point): number {
  return Math.abs(
    prev[0] * (current[1] - next[1]) +
    current[0] * (next[1] - prev[1]) +
    next[0] * (prev[1] - current[1])
  ) / 2;
}

function isSamePoint(a: Point, b: Point, tolerance = 1e-9): boolean {
  return squaredDistance(a, b) <= tolerance * tolerance;
}

function getTurnAngle(prev: Point, current: Point, next: Point): number {
  const inX = current[0] - prev[0];
  const inY = current[1] - prev[1];
  const outX = next[0] - current[0];
  const outY = next[1] - current[1];
  const inLength = Math.hypot(inX, inY);
  const outLength = Math.hypot(outX, outY);

  if (inLength === 0 || outLength === 0) {
    return Math.PI;
  }

  const dot = (inX * outX + inY * outY) / (inLength * outLength);
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

function isSharpCorner(prev: Point, current: Point, next: Point, threshold = DEFAULT_CORNER_ANGLE_THRESHOLD): boolean {
  return getTurnAngle(prev, current, next) < threshold;
}

function removeClosingPoint(contour: Point[]): Point[] {
  if (contour.length > 1 && isSamePoint(contour[0]!, contour[contour.length - 1]!)) {
    return contour.slice(0, -1);
  }
  return [...contour];
}

function normalizeClosedContour(contour: Point[], minimumSpacing: number): Point[] {
  const openContour = removeClosingPoint(contour);
  if (openContour.length <= MIN_CONTOUR_POINTS) {
    return openContour;
  }

  const normalized: Point[] = [];
  const minSpacing = Math.max(minimumSpacing * 0.25, 1e-5);

  for (const point of openContour) {
    if (!normalized.length || distance(normalized[normalized.length - 1]!, point) >= minSpacing) {
      normalized.push(point);
    }
  }

  while (normalized.length > MIN_CONTOUR_POINTS && distance(normalized[0]!, normalized[normalized.length - 1]!) < minSpacing) {
    normalized.pop();
  }

  return normalized;
}

function computeNodeError(node: SimplificationNode): number {
  if (!node.prev || !node.next) {
    return Number.POSITIVE_INFINITY;
  }

  const baseLength = distance(node.prev.point, node.next.point);
  if (baseLength === 0) {
    return 0;
  }

  const area = triangleArea(node.prev.point, node.point, node.next.point);
  return (2 * area) / baseLength;
}

function refreshNode(node: SimplificationNode): void {
  if (!node.prev || !node.next) {
    node.removable = false;
    node.error = Number.POSITIVE_INFINITY;
    return;
  }

  // For simplification, let `epsilon` be the only gate.
  // Corner preservation is handled by keeping large-error points and by the optional smoothing step.
  node.removable = true;
  node.error = computeNodeError(node);
}

function simplifyClosedContour(points: Point[], epsilon: number): Point[] {
  if (points.length <= 8) {
    return points;
  }

  const nodes = points.map<SimplificationNode>((point, index) => ({
    index,
    point,
    prev: null,
    next: null,
    error: Number.POSITIVE_INFINITY,
    removable: true,
  }));

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]!;
    node.prev = nodes[(index - 1 + nodes.length) % nodes.length]!;
    node.next = nodes[(index + 1) % nodes.length]!;
  }

  for (const node of nodes) {
    refreshNode(node);
  }

  const errorThreshold = Math.max(epsilon, 0);
  let activeCount = nodes.length;
  const minimumPoints = MIN_CONTOUR_POINTS;

  while (activeCount > minimumPoints) {
    let candidate: SimplificationNode | null = null;

    for (const node of nodes) {
      if (!node.prev || !node.next) {
        continue;
      }
      if (node.error > errorThreshold) {
        continue;
      }
      if (!candidate || node.error < candidate.error || (node.error === candidate.error && node.index < candidate.index)) {
        candidate = node;
      }
    }

    if (!candidate || !candidate.prev || !candidate.next) {
      break;
    }

    candidate.prev.next = candidate.next;
    candidate.next.prev = candidate.prev;

    refreshNode(candidate.prev);
    refreshNode(candidate.next);

    candidate.prev = null;
    candidate.next = null;
    candidate.error = Number.POSITIVE_INFINITY;
    activeCount--;
  }

  const simplified: Point[] = [];
  let node = nodes.find((entry) => entry.prev && entry.next) ?? null;
  if (!node) {
    return points;
  }

  const firstIndex = node.index;
  do {
    simplified.push(node.point);
    node = node.next;
  } while (node && node.index !== firstIndex);

  return simplified;
}

function filterCloseNeighbors(points: Point[], minimumSpacing: number): Point[] {
  if (!points.length) {
    return points;
  }

  const filtered: Point[] = [points[0]!];

  for (let index = 1; index < points.length; index++) {
    const point = points[index]!;
    if (distance(filtered[filtered.length - 1]!, point) >= minimumSpacing) {
      filtered.push(point);
    }
  }

  while (filtered.length > MIN_CONTOUR_POINTS && distance(filtered[0]!, filtered[filtered.length - 1]!) < minimumSpacing) {
    filtered.pop();
  }

  return filtered;
}

function resampleClosedContourWithMaxPoints(points: Point[], spacing: number, maxPoints: number): Point[] {
  if (points.length <= MIN_CONTOUR_POINTS) {
    return points;
  }

  const segmentLengths = points.map((point, index) => distance(point, points[(index + 1) % points.length]!));
  const perimeter = segmentLengths.reduce((sum, value) => sum + value, 0);

  if (perimeter === 0) {
    return points;
  }

  const unclampedCount = Math.round(perimeter / spacing);
  const targetCount = Math.max(MIN_CONTOUR_POINTS, Math.min(Math.max(maxPoints, MIN_CONTOUR_POINTS), unclampedCount));
  // Never upsample: resampling is only for reducing points / regularizing spacing.
  // Upsampling would hide the effect of `epsilon` (simplification).
  if (targetCount >= points.length) {
    return points;
  }

  const step = perimeter / targetCount;
  const resampled: Point[] = [];
  let segmentIndex = 0;
  let segmentStartDistance = 0;

  for (let sampleIndex = 0; sampleIndex < targetCount; sampleIndex++) {
    const targetDistance = sampleIndex * step;

    while (
      segmentIndex < segmentLengths.length - 1 &&
      segmentStartDistance + segmentLengths[segmentIndex]! < targetDistance
    ) {
      segmentStartDistance += segmentLengths[segmentIndex]!;
      segmentIndex++;
    }

    const start = points[segmentIndex]!;
    const end = points[(segmentIndex + 1) % points.length]!;
    const segmentLength = segmentLengths[segmentIndex]!;
    const localDistance = targetDistance - segmentStartDistance;
    const t = segmentLength === 0 ? 0 : localDistance / segmentLength;

    resampled.push([
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
    ]);
  }

  return resampled;
}

function smoothClosedContour(points: Point[]): Point[] {
  if (points.length <= MIN_CONTOUR_POINTS) {
    return points;
  }

  const smoothed: Point[] = [];

  for (let index = 0; index < points.length; index++) {
    const prev = points[(index - 1 + points.length) % points.length]!;
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;

    // Preserve corners; smoothing tends to shrink/round sharp features.
    if (isSharpCorner(prev, current, next)) {
      smoothed.push(current);
      continue;
    }

    // Light, stable smoothing that keeps point count constant.
    smoothed.push([
      0.25 * prev[0] + 0.5 * current[0] + 0.25 * next[0],
      0.25 * prev[1] + 0.5 * current[1] + 0.25 * next[1],
    ]);
  }

  return smoothed;
}

/**
 * Simplify + resample a closed contour.
 *
 * Coordinates are expected to be normalized to [0,1].
 *
 * @param contour Closed polygon points (the last point may equal the first; it will be normalized).
 * @param epsilon Simplification tolerance in normalized units (higher -> fewer points).
 * @param smoothingIterations Light corner-preserving smoothing passes (0 disables; increases shape change).
 * @param resolution Target point spacing along the perimeter in normalized units (higher -> fewer points).
 */
export function resampleContour(
  contour: Point[],
  epsilon = 0.002,
  smoothingIterations = 2,
  resolution = 0.005,
): Point[] {
  const normalized = normalizeClosedContour(contour, resolution);
  if (normalized.length <= MIN_CONTOUR_POINTS) {
    return normalized.length >= MIN_CONTOUR_POINTS ? normalized : contour;
  }

  let simplified = simplifyClosedContour(normalized, epsilon);

  for (let index = 0; index < smoothingIterations; index++) {
    simplified = smoothClosedContour(simplified);
  }

  simplified = resampleClosedContourWithMaxPoints(simplified, resolution, normalized.length);
  simplified = filterCloseNeighbors(simplified, resolution * 0.5);

  console.debug(
    `Resampling closed contour with ${contour.length} points, epsilon=${epsilon}, smoothingIterations=${smoothingIterations}, resolution=${resolution}, resulting in ${simplified.length} points.`,
  );

  if (simplified.length >= contour.length) {
    return normalized.length < contour.length ? normalized : contour;
  }

  return simplified;
}

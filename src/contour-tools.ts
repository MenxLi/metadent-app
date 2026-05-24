type Point = [number, number];

type SimplificationNode = {
  index: number;
  point: Point;
  prev: SimplificationNode | null;
  next: SimplificationNode | null;
  error: number;
};

const MIN_CONTOUR_POINTS = 3;
const HARD_CORNER_ANGLE_THRESHOLD = (100 * Math.PI) / 180;
const SOFT_CORNER_ANGLE_THRESHOLD = (155 * Math.PI) / 180;
const CORNER_WINDOW_FACTOR = 2.5;
const MIN_CORNER_WINDOW = 0.003;
const MIN_CHAIKIN_CUT_RATIO = 0.06;
const MAX_CHAIKIN_CUT_RATIO = 0.25;

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function triangleArea(prev: Point, current: Point, next: Point): number {
  return Math.abs(
    prev[0] * (current[1] - next[1]) +
    current[0] * (next[1] - prev[1]) +
    next[0] * (prev[1] - current[1])
  ) / 2;
}

function isSamePoint(a: Point, b: Point, tolerance = 1e-9): boolean {
  return distance(a, b) <= tolerance;
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
  return Math.acos(clamp(dot, -1, 1));
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
    node.error = Number.POSITIVE_INFINITY;
    return;
  }

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

function getClosedContourMetrics(points: Point[]): { segmentLengths: number[]; perimeter: number } {
  const segmentLengths = points.map((point, index) => distance(point, points[(index + 1) % points.length]!));
  const perimeter = segmentLengths.reduce((sum, value) => sum + value, 0);
  return { segmentLengths, perimeter };
}

function resampleClosedContourWithMaxPoints(points: Point[], spacing: number, maxPoints: number): Point[] {
  if (points.length <= MIN_CONTOUR_POINTS) {
    return points;
  }

  const { segmentLengths, perimeter } = getClosedContourMetrics(points);

  if (perimeter === 0) {
    return points;
  }

  const unclampedCount = Math.round(perimeter / spacing);
  const targetCount = clamp(unclampedCount, MIN_CONTOUR_POINTS, Math.max(maxPoints, MIN_CONTOUR_POINTS));
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

function getArcWindowPoint(points: Point[], index: number, step: 1 | -1, windowDistance: number): Point {
  if (!points.length || windowDistance <= 0) {
    return points[index]!;
  }

  const length = points.length;
  let cursor = index;
  let remaining = windowDistance;

  while (remaining > 0) {
    const nextCursor = (cursor + step + length) % length;
    const start = points[cursor]!;
    const end = points[nextCursor]!;
    const segmentLength = distance(start, end);

    if (segmentLength > 0 && segmentLength >= remaining) {
      const t = remaining / segmentLength;
      return [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
      ];
    }

    if (segmentLength > 0) {
      remaining -= segmentLength;
    }

    cursor = nextCursor;

    if (cursor === index) {
      break;
    }
  }

  return points[cursor]!;
}

function chaikinStepClosedContour(points: Point[], cornerFactors: number[]): Point[] {
  if (points.length <= MIN_CONTOUR_POINTS) {
    return points;
  }

  const refined: Point[] = [];

  for (let index = 0; index < points.length; index++) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const edgeFactor = Math.min(cornerFactors[index]!, cornerFactors[(index + 1) % points.length]!);
    const cut = MIN_CHAIKIN_CUT_RATIO + (MAX_CHAIKIN_CUT_RATIO - MIN_CHAIKIN_CUT_RATIO) * clamp(edgeFactor, 0, 1);

    const q: Point = [
      (1 - cut) * current[0] + cut * next[0],
      (1 - cut) * current[1] + cut * next[1],
    ];
    const r: Point = [
      cut * current[0] + (1 - cut) * next[0],
      cut * current[1] + (1 - cut) * next[1],
    ];

    refined.push(q, r);
  }

  return refined;
}

function smoothClosedContour(points: Point[], baseSpacing: number): Point[] {
  if (points.length <= MIN_CONTOUR_POINTS) {
    return points;
  }

  const { perimeter } = getClosedContourMetrics(points);
  if (perimeter === 0) {
    return points;
  }

  const averageSpacing = perimeter / points.length;
  const desiredWindow = Math.max(baseSpacing * CORNER_WINDOW_FACTOR, averageSpacing * 1.5, MIN_CORNER_WINDOW);
  const cornerWindow = Math.min(desiredWindow, perimeter * 0.25);

  const cornerFactors = points.map((current, index) => {
    const prev = getArcWindowPoint(points, index, -1, cornerWindow);
    const next = getArcWindowPoint(points, index, 1, cornerWindow);
    const angle = getTurnAngle(prev, current, next);

    // Preserve strong corners, and taper smoothing on moderate corners.
    if (angle <= HARD_CORNER_ANGLE_THRESHOLD) {
      return 0;
    }

    if (angle >= SOFT_CORNER_ANGLE_THRESHOLD) {
      return 1;
    }

    return (angle - HARD_CORNER_ANGLE_THRESHOLD) / (SOFT_CORNER_ANGLE_THRESHOLD - HARD_CORNER_ANGLE_THRESHOLD);
  });

  const chaikinRefined = chaikinStepClosedContour(points, cornerFactors);

  // Chaikin doubles points; regularize back to the original count for stable downstream behavior.
  const targetSpacing = perimeter / points.length;
  return resampleClosedContourWithMaxPoints(chaikinRefined, targetSpacing, points.length);
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
  epsilon = 0.001,
  smoothingIterations = 2,
  resolution = 0.005,
): Point[] {
  const normalized = normalizeClosedContour(contour, resolution);
  if (normalized.length <= MIN_CONTOUR_POINTS) {
    return normalized.length >= MIN_CONTOUR_POINTS ? normalized : contour;
  }

  let simplified = simplifyClosedContour(normalized, epsilon);

  for (let index = 0; index < smoothingIterations; index++) {
    simplified = smoothClosedContour(simplified, resolution);
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

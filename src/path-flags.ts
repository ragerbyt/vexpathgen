import { FlagModel, pathPoint, section } from "./globals";

export type DerivedFlagPlacement = {
  clampedPathDistance: number;
  segmentIndex: number;
  segmentRange: { startIndex: number; endIndex: number } | null;
  segmentStartDistance: number;
  segmentEndDistance: number;
  localRatio: number;
  time: number;
  nearestPathpointIndex: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getPathDistanceMax(pathpoints: pathPoint[]): number {
  if (pathpoints.length === 0) return 0;
  return Math.max(0, pathpoints[pathpoints.length - 1].dist);
}

export function clampFlagPathDistance(pathDistance: number, pathpoints: pathPoint[]): number {
  if (!Number.isFinite(pathDistance)) return 0;
  return clamp(pathDistance, 0, getPathDistanceMax(pathpoints));
}

function getSegmentDistanceRange(segment: section, pathpoints: pathPoint[]) {
  if (
    segment.startpath === undefined ||
    segment.endpath === undefined ||
    pathpoints.length === 0
  ) {
    return null;
  }

  const lastIndex = pathpoints.length - 1;
  const startIndex = clamp(segment.startpath, 0, lastIndex);
  const endIndex = clamp(segment.endpath, 0, lastIndex);
  const startDistance = pathpoints[startIndex].dist;
  const endDistance = pathpoints[endIndex].dist;

  return {
    startIndex: Math.min(startIndex, endIndex),
    endIndex: Math.max(startIndex, endIndex),
    startDistance: Math.min(startDistance, endDistance),
    endDistance: Math.max(startDistance, endDistance),
  };
}

function getOwningSegmentIndex(
  pathDistance: number,
  sections: section[],
  pathpoints: pathPoint[]
): number {
  if (sections.length === 0 || pathpoints.length === 0) return -1;

  for (let index = 0; index < sections.length; index++) {
    const range = getSegmentDistanceRange(sections[index], pathpoints);
    if (!range) continue;

    if (pathDistance === 0 && range.startDistance === 0) {
      return index;
    }

    const isLast = index === sections.length - 1;
    const lowerBoundInclusive = pathDistance >= range.startDistance;
    const upperBoundInclusive = isLast || pathDistance < range.endDistance;
    const atSegmentEnd = pathDistance === range.endDistance;

    if (lowerBoundInclusive && (upperBoundInclusive || atSegmentEnd)) {
      if (atSegmentEnd && !isLast) {
        continue;
      }
      return index;
    }
  }

  for (let index = sections.length - 1; index >= 0; index--) {
    if (getSegmentDistanceRange(sections[index], pathpoints)) {
      return index;
    }
  }

  return -1;
}

function getInterpolatedTimeForDistance(pathDistance: number, pathpoints: pathPoint[]): number {
  if (pathpoints.length === 0) return 0;
  if (pathpoints.length === 1) return pathpoints[0].time;

  const clampedDistance = clampFlagPathDistance(pathDistance, pathpoints);
  for (let index = 0; index < pathpoints.length; index++) {
    if (pathpoints[index].dist === clampedDistance) {
      return pathpoints[index].time;
    }
  }

  for (let index = 1; index < pathpoints.length; index++) {
    const prev = pathpoints[index - 1];
    const next = pathpoints[index];
    if (clampedDistance > next.dist) continue;

    const span = next.dist - prev.dist;
    if (span <= 1e-9) {
      return next.time;
    }

    const ratio = clamp((clampedDistance - prev.dist) / span, 0, 1);
    return prev.time + (next.time - prev.time) * ratio;
  }

  return pathpoints[pathpoints.length - 1].time;
}

export function getNearestPathpointIndexForFlag(
  flag: Pick<FlagModel, "pathDistance">,
  pathpoints: pathPoint[]
): number {
  if (pathpoints.length === 0) return -1;

  const targetDistance = clampFlagPathDistance(flag.pathDistance, pathpoints);
  let bestIndex = 0;
  let bestDistance = Math.abs(pathpoints[0].dist - targetDistance);

  for (let index = 1; index < pathpoints.length; index++) {
    const nextDistance = Math.abs(pathpoints[index].dist - targetDistance);
    if (nextDistance < bestDistance || (nextDistance === bestDistance && index > bestIndex)) {
      bestIndex = index;
      bestDistance = nextDistance;
    }
  }

  return bestIndex;
}

export function getDerivedFlagPlacement(
  flag: Pick<FlagModel, "pathDistance">,
  sections: section[],
  pathpoints: pathPoint[]
): DerivedFlagPlacement {
  const clampedPathDistance = clampFlagPathDistance(flag.pathDistance, pathpoints);
  const segmentIndex = getOwningSegmentIndex(clampedPathDistance, sections, pathpoints);

  if (segmentIndex < 0) {
    return {
      clampedPathDistance,
      segmentIndex: -1,
      segmentRange: null,
      segmentStartDistance: 0,
      segmentEndDistance: 0,
      localRatio: 0,
      time: getInterpolatedTimeForDistance(clampedPathDistance, pathpoints),
      nearestPathpointIndex: getNearestPathpointIndexForFlag({ pathDistance: clampedPathDistance }, pathpoints),
    };
  }

  const segment = sections[segmentIndex];
  const distanceRange = getSegmentDistanceRange(segment, pathpoints);
  if (!distanceRange) {
    return {
      clampedPathDistance,
      segmentIndex: -1,
      segmentRange: null,
      segmentStartDistance: 0,
      segmentEndDistance: 0,
      localRatio: 0,
      time: getInterpolatedTimeForDistance(clampedPathDistance, pathpoints),
      nearestPathpointIndex: getNearestPathpointIndexForFlag({ pathDistance: clampedPathDistance }, pathpoints),
    };
  }

  const span = distanceRange.endDistance - distanceRange.startDistance;
  const localRatio = span <= 1e-9
    ? 0
    : clamp((clampedPathDistance - distanceRange.startDistance) / span, 0, 1);

  return {
    clampedPathDistance,
    segmentIndex,
    segmentRange: {
      startIndex: distanceRange.startIndex,
      endIndex: distanceRange.endIndex,
    },
    segmentStartDistance: distanceRange.startDistance,
    segmentEndDistance: distanceRange.endDistance,
    localRatio,
    time: getInterpolatedTimeForDistance(clampedPathDistance, pathpoints),
    nearestPathpointIndex: getNearestPathpointIndexForFlag({ pathDistance: clampedPathDistance }, pathpoints),
  };
}

export function getDerivedFlagTime(
  flag: Pick<FlagModel, "pathDistance">,
  pathpoints: pathPoint[]
): number {
  return getInterpolatedTimeForDistance(flag.pathDistance, pathpoints);
}

export function getPathDistanceForTime(time: number, pathpoints: pathPoint[]): number {
  if (pathpoints.length === 0) return 0;
  if (pathpoints.length === 1) return pathpoints[0].dist;

  const maxTime = Math.max(0, pathpoints[pathpoints.length - 1].time);
  const clampedTime = clamp(time, 0, maxTime);

  for (let index = 0; index < pathpoints.length; index++) {
    if (pathpoints[index].time === clampedTime) {
      return pathpoints[index].dist;
    }
  }

  for (let index = 1; index < pathpoints.length; index++) {
    const prev = pathpoints[index - 1];
    const next = pathpoints[index];
    if (clampedTime > next.time) continue;

    const span = next.time - prev.time;
    if (span <= 1e-9) {
      return next.dist;
    }

    const ratio = clamp((clampedTime - prev.time) / span, 0, 1);
    return prev.dist + (next.dist - prev.dist) * ratio;
  }

  return pathpoints[pathpoints.length - 1].dist;
}

export function sortFlagsByDerivedTime(
  flagList: FlagModel[],
  sections: section[],
  pathpoints: pathPoint[]
) {
  flagList.sort((a, b) => {
    const timeDelta = getDerivedFlagTime(a, pathpoints) - getDerivedFlagTime(b, pathpoints);
    if (Math.abs(timeDelta) > 1e-9) return timeDelta;

    const distanceDelta =
      clampFlagPathDistance(a.pathDistance, pathpoints) - clampFlagPathDistance(b.pathDistance, pathpoints);
    if (Math.abs(distanceDelta) > 1e-9) return distanceDelta;

    const segmentDelta =
      getDerivedFlagPlacement(a, sections, pathpoints).segmentIndex -
      getDerivedFlagPlacement(b, sections, pathpoints).segmentIndex;
    if (segmentDelta !== 0) return segmentDelta;

    return a.id.localeCompare(b.id);
  });
}

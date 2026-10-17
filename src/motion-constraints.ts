export type MotionConstraintSettings = {
  trackWidth: number;
  maxLinearVelocity: number;
  maxTurnVelocity: number;
  maxAcceleration: number;
  linearTau: number;
  turnTau: number;
  saturation: number;
};

export type WheelConstraintPoint = {
  velocity: number;
  curvature: number;
};

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getSaturationFactor(settings: MotionConstraintSettings): number {
  return clamp01(settings.saturation / 100);
}

export function getLeftGain(curvature: number, trackWidth: number): number {
  return 1 - curvature * trackWidth / 2;
}

export function getRightGain(curvature: number, trackWidth: number): number {
  return 1 + curvature * trackWidth / 2;
}

export function getMaxWheelGain(curvature: number, trackWidth: number): number {
  return Math.max(
    Math.abs(getLeftGain(curvature, trackWidth)),
    Math.abs(getRightGain(curvature, trackWidth)),
    1e-6
  );
}

export function getTurnBlend(curvature: number, trackWidth: number): number {
  const leftGain = getLeftGain(curvature, trackWidth);
  const rightGain = getRightGain(curvature, trackWidth);
  const gainSum = Math.abs(leftGain) + Math.abs(rightGain);
  return gainSum > 0 ? Math.abs(leftGain - rightGain) / gainSum : 0;
}

export function getEffectiveWheelVelocityCap(
  settings: MotionConstraintSettings,
  curvature: number
): number {
  const turnBlend = getTurnBlend(curvature, settings.trackWidth);
  const interpolatedCap = settings.maxLinearVelocity
    + (settings.maxTurnVelocity - settings.maxLinearVelocity) * turnBlend;
  return getSaturationFactor(settings) * interpolatedCap;
}

export function getCurvatureLimitedVelocity(
  settings: MotionConstraintSettings,
  curvature: number
): number {
  return getEffectiveWheelVelocityCap(settings, curvature)
    / getMaxWheelGain(curvature, settings.trackWidth);
}

export function getEffectiveTau(settings: MotionConstraintSettings, curvature: number): number {
  const turnBlend = getTurnBlend(curvature, settings.trackWidth);
  return settings.linearTau + (settings.turnTau - settings.linearTau) * turnBlend;
}

export function getAvailableAcceleration(
  settings: MotionConstraintSettings,
  velocity: number,
  curvature: number
): number {
  const velocityCap = getCurvatureLimitedVelocity(settings, curvature);
  const tau = Math.max(getEffectiveTau(settings, curvature), 1e-6);
  const tauLimit = Math.max(0, velocityCap - Math.abs(velocity)) / tau;
  return Math.min(getSaturationFactor(settings) * settings.maxAcceleration, tauLimit);
}

export function getMaxAngularVelocity(settings: MotionConstraintSettings): number {
  return (2 * getSaturationFactor(settings) * settings.maxTurnVelocity)
    / Math.max(settings.trackWidth, 1e-6);
}

export function getAvailableAngularAcceleration(
  settings: MotionConstraintSettings,
  angularVelocity: number
): number {
  const tau = Math.max(settings.turnTau, 1e-6);
  return Math.max(0, getMaxAngularVelocity(settings) - Math.abs(angularVelocity)) / tau;
}

export function getWheelStepDistance(ds: number, gainA: number, gainB: number): number {
  return ds * Math.max((Math.abs(gainA) + Math.abs(gainB)) / 2, 1e-6);
}

function maxLinearVelocityFromWheelState(
  neighborWheelVelocity: number,
  wheelStepDistance: number,
  currentGain: number,
  accelLimit: number
): number {
  const maxAbsWheelVelocity = Math.sqrt(
    Math.max(0, neighborWheelVelocity ** 2 + 2 * accelLimit * wheelStepDistance)
  );
  return Math.abs(currentGain) < 1e-9 ? Infinity : maxAbsWheelVelocity / Math.abs(currentGain);
}

export function getWheelVelocityBounds(
  previous: WheelConstraintPoint,
  current: WheelConstraintPoint,
  ds: number,
  accelLimit: number,
  trackWidth: number
): { leftBound: number; rightBound: number } {
  const previousLeftGain = getLeftGain(previous.curvature, trackWidth);
  const currentLeftGain = getLeftGain(current.curvature, trackWidth);
  const previousRightGain = getRightGain(previous.curvature, trackWidth);
  const currentRightGain = getRightGain(current.curvature, trackWidth);

  const leftStepDistance = getWheelStepDistance(ds, previousLeftGain, currentLeftGain);
  const rightStepDistance = getWheelStepDistance(ds, previousRightGain, currentRightGain);

  return {
    leftBound: maxLinearVelocityFromWheelState(
      previous.velocity * previousLeftGain, leftStepDistance, currentLeftGain, accelLimit
    ),
    rightBound: maxLinearVelocityFromWheelState(
      previous.velocity * previousRightGain, rightStepDistance, currentRightGain, accelLimit
    ),
  };
}

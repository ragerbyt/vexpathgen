export type RobotProjection = (x: number, y: number) => { x: number; y: number };

export type RobotRenderStyle = {
  fillStyle: string;
  strokeStyle: string;
  headingStrokeStyle?: string;
  lineWidth?: number;
  headingLineWidth?: number;
  headingLength?: number;
};

export type RobotRenderPose = {
  x: number;
  y: number;
  thetaRadians: number;
  length: number;
  width: number;
  centerOffsetFromBack: number;
};

export function drawRobotOutline(
  ctx: CanvasRenderingContext2D,
  pose: RobotRenderPose,
  project: RobotProjection,
  style: RobotRenderStyle
): void {
  const cosTheta = Math.cos(pose.thetaRadians);
  const sinTheta = Math.sin(pose.thetaRadians);
  const halfWidth = pose.width / 2;
  const frontDist = pose.length - pose.centerOffsetFromBack;
  const backDist = -pose.centerOffsetFromBack;

  const corners: Array<[number, number]> = [
    [frontDist, -halfWidth],
    [frontDist, halfWidth],
    [backDist, halfWidth],
    [backDist, -halfWidth]
  ];

  ctx.fillStyle = style.fillStyle;
  ctx.strokeStyle = style.strokeStyle;
  ctx.lineWidth = style.lineWidth ?? 2;
  ctx.beginPath();

  corners.forEach((corner, cornerIndex) => {
    const worldX = pose.x + (cosTheta * corner[0] - sinTheta * corner[1]);
    const worldY = pose.y + (sinTheta * corner[0] + cosTheta * corner[1]);
    const screen = project(worldX, worldY);

    if (cornerIndex === 0) {
      ctx.moveTo(screen.x, screen.y);
    } else {
      ctx.lineTo(screen.x, screen.y);
    }
  });

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const headingLength = style.headingLength ?? 5;
  const frontX = pose.x + cosTheta * frontDist;
  const frontY = pose.y + sinTheta * frontDist;
  const tipX = frontX + cosTheta * headingLength;
  const tipY = frontY + sinTheta * headingLength;

  ctx.strokeStyle = style.headingStrokeStyle ?? style.strokeStyle;
  ctx.lineWidth = style.headingLineWidth ?? ctx.lineWidth;
  ctx.beginPath();
  const frontScreen = project(frontX, frontY);
  const tipScreen = project(tipX, tipY);
  ctx.moveTo(frontScreen.x, frontScreen.y);
  ctx.lineTo(tipScreen.x, tipScreen.y);
  ctx.stroke();
}
export type ViewerConnectionKey =
  | "imu"
  | "distFront"
  | "distRight"
  | "distBack"
  | "distLeft"
  | "encFL"
  | "encML"
  | "encBL"
  | "encFR"
  | "encMR"
  | "encBR"
  | "encIntake1"
  | "encIntake2";

export interface ViewerRobotState {
  x: number;
  y: number;
  theta: number;
  tick: number;
  elapsed: number;
  battery: number;
  leftOutput: number;
  rightOutput: number;
  intakeTemp: number;
  leftTemp: number;
  rightTemp: number;
}

export interface ViewerConnectionState {
  imu: boolean;
  distFront: boolean;
  distRight: boolean;
  distBack: boolean;
  distLeft: boolean;
  encFL: boolean;
  encML: boolean;
  encBL: boolean;
  encFR: boolean;
  encMR: boolean;
  encBR: boolean;
  encIntake1: boolean;
  encIntake2: boolean;
}

export interface ViewerFrame {
  robot: ViewerRobotState;
  connections: ViewerConnectionState | null;
  distances: number[] | null;
  sensorValid?: boolean[];
  rayEndpoints?: Array<{ x: number; y: number }>;
  particles: Array<{ x: number; y: number; w: number }>;
}

export const WARNING_PORT_META: Array<{ key: ViewerConnectionKey; name: string; port: number }> = [
  { key: "imu", name: "inertial sensor", port: 1 },
  { key: "distFront", name: "front distance sensor", port: 17 },
  { key: "distRight", name: "right distance sensor", port: 6 },
  { key: "distBack", name: "back distance sensor", port: 19 },
  { key: "distLeft", name: "left distance sensor", port: 5 },
  { key: "encFL", name: "front-left motor encoder", port: 11 },
  { key: "encML", name: "middle-left motor encoder", port: 12 },
  { key: "encBL", name: "back-left motor encoder", port: 13 },
  { key: "encFR", name: "front-right motor encoder", port: 15 },
  { key: "encMR", name: "middle-right motor encoder", port: 14 },
  { key: "encBR", name: "back-right motor encoder", port: 16 },
  { key: "encIntake1", name: "intake motor encoder 1", port: 3 },
  { key: "encIntake2", name: "intake motor encoder 2", port: 4 }
];

export const ROBOT_WIDTH = 13.5;
export const ROBOT_LENGTH = 15;
export const ROBOT_CENTER_OFFSET_FROM_BACK = 6;

export const SENSOR_OFFSETS: Array<[number, number]> = [
  [2.33, -4.55],
  [2.0, -5.1],
  [-3.15, -3.8],
  [2.3, 5.1]
];

export const SENSOR_ANGLES = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

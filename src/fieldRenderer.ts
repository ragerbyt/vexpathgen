export type FieldWindow = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type ViewWindowRender = {
  mode: "view-window";
  view: FieldWindow;
  fieldSizeInches?: number;
};

type CenteredRender = {
  mode: "centered";
  worldHalfSizeInches: number;
  fieldHalfSizeInches: number;
};

export type FieldRenderOptions = ViewWindowRender | CenteredRender;

export function drawFieldImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  options: FieldRenderOptions
): void {
  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (options.mode === "view-window") {
    const fieldSize = options.fieldSizeInches ?? 144;
    const view = options.view;
    const sx = (view.left / fieldSize) * image.naturalWidth;
    const sy = ((fieldSize - view.bottom) / fieldSize) * image.naturalHeight;
    const sWidth = ((view.right - view.left) / fieldSize) * image.naturalWidth;
    const sHeight = ((view.bottom - view.top) / fieldSize) * image.naturalHeight;

    ctx.drawImage(
      image,
      sx,
      sy,
      Math.max(1, sWidth),
      Math.max(1, sHeight),
      0,
      0,
      width,
      height
    );
    return;
  }

  const scale = width / (options.worldHalfSizeInches * 2);
  const cx = width / 2;
  const cy = height / 2;
  const fieldHalf = options.fieldHalfSizeInches;
  ctx.drawImage(
    image,
    cx - fieldHalf * scale,
    cy - fieldHalf * scale,
    fieldHalf * 2 * scale,
    fieldHalf * 2 * scale
  );
}

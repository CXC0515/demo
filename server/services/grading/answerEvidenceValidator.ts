/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import sharp from 'sharp';

export interface PixelRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const containsRegion = (container: PixelRegion, item: PixelRegion, tolerance = 2) => (
  item.x >= container.x - tolerance
  && item.y >= container.y - tolerance
  && item.x + item.width <= container.x + container.width + tolerance
  && item.y + item.height <= container.y + container.height + tolerance
);

export const expandRegion = (
  region: PixelRegion,
  limit: PixelRegion,
  imageWidth: number,
  imageHeight: number
): PixelRegion => {
  const horizontalPadding = Math.max(12, Math.round(region.width * 0.18));
  const verticalPadding = Math.max(8, Math.round(region.height * 0.3));
  const left = Math.max(0, limit.x, region.x - horizontalPadding);
  const top = Math.max(0, limit.y, region.y - verticalPadding);
  const right = Math.min(imageWidth, limit.x + limit.width, region.x + region.width + horizontalPadding);
  const bottom = Math.min(imageHeight, limit.y + limit.height, region.y + region.height + verticalPadding);
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
};

export const inspectCropEdges = async (cropPath: string) => {
  const { data, info } = await sharp(cropPath).greyscale().raw().toBuffer({ resolveWithObject: true });
  const bandX = Math.max(2, Math.round(info.width * 0.025));
  const bandY = Math.max(2, Math.round(info.height * 0.04));
  const rowDark = Array.from({ length: info.height }, () => 0);
  const columnDark = Array.from({ length: info.width }, () => 0);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[y * info.width + x] < 170) {
        rowDark[y] += 1;
        columnDark[x] += 1;
      }
    }
  }
  let edgeDark = 0;
  let edgePixels = 0;
  let innerDark = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[y * info.width + x] >= 170) continue;
      const atEdge = x < bandX || x >= info.width - bandX || y < bandY || y >= info.height - bandY;
      const isPrintedRule = rowDark[y] > info.width * 0.65 || columnDark[x] > info.height * 0.65;
      if (atEdge && !isPrintedRule) edgeDark += 1;
      else innerDark += 1;
    }
  }
  edgePixels = (bandX * info.height * 2) + (bandY * Math.max(0, info.width - bandX * 2) * 2);
  const edgeRatio = edgePixels ? edgeDark / edgePixels : 0;
  return {
    hasContent: innerDark > 8,
    touchesEdge: edgeDark > 8 && edgeRatio > 0.015,
    edgeRatio
  };
};

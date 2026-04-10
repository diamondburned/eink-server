import sharp, { type PngOptions } from "sharp";
import type { DitheringConfig } from "./config.js";

// ditherPNG applies grayscale dithering to a raw PNG buffer according to the
// given DitheringConfig and returns a new PNG buffer.
//
// The pipeline mirrors the Go server's imaging.ProcessScreenshot logic:
//   1. Decode the PNG.
//   2. Convert to grayscale.
//   3. Quantize to `colors` evenly-spaced levels.
//      - "none": nearest-level quantization only (no diffusion).
//      - "floyd-steinberg": error-diffusion dithering.
//   4. Re-encode as PNG.
export async function ditherPNG(input: Buffer, cfg: DitheringConfig): Promise<Buffer> {
  const { colors, algorithm } = cfg;

  if (colors < 2 || colors > 256) {
    throw new Error(`dithering colors must be between 2 and 256, got ${colors}`);
  }

  const pngOpts: PngOptions = {
    compressionLevel: 3,
    palette: true,
    colors,
  };

  switch (algorithm) {
    case "floyd-steinberg": {
      pngOpts.dither = 0.5;
      break;
    }
    case "none": {
      pngOpts.dither = 0;
      break;
    }
    default: {
      throw new Error(`unsupported dithering algorithm: ${algorithm}`);
    }
  }

  let s = sharp(input);
  if (colors == 2) {
    s = s.toColorspace("b-w");
  }
  s = s.png(pngOpts);
  return s.toBuffer();
}

// Package imaging provides image post-processing utilities for screenshots.
package imaging

import (
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"io"
	"log/slog"
	"slices"

	"golang.org/x/image/bmp"
	xdraw "golang.org/x/image/draw"

	"github.com/diamondburned/eink-server/internal/config"
)

// ProcessScreenshot applies post-processing to a screenshot and encodes it in the specified format
func ProcessScreenshot(r io.Reader, cfg config.Postprocessing, format config.ImageFormat, originalScale float64, dst io.Writer) error {
	img, _, err := image.Decode(r)
	if err != nil {
		return fmt.Errorf("failed to decode screenshot: %w", err)
	}

	// Apply rescaling if needed.
	if originalScale != 1.0 {
		img = rescaleImage(img, originalScale)
	}

	// Apply dithering if configured
	if cfg.Dithering.Algorithm != "" {
		img, err = applyDithering(img, cfg.Dithering)
		if err != nil {
			return fmt.Errorf("failed to apply dithering: %w", err)
		}
	}

	// Encode based on format
	switch format {
	case config.ImageFormatBMP:
		return bmp.Encode(dst, img)
	case config.ImageFormatPNG, "":
		return png.Encode(dst, img)
	default:
		return fmt.Errorf("unknown image format %q (supported: png, bmp)", format)
	}
}

var defaultScaler xdraw.Scaler = xdraw.CatmullRom

func rescaleImage(img image.Image, scale float64) image.Image {
	scaledRect := img.Bounds()
	scaledRect.Max.X = int(float64(scaledRect.Max.X) / scale)
	scaledRect.Max.Y = int(float64(scaledRect.Max.Y) / scale)

	scaledImg := image.NewNRGBA(scaledRect)
	defaultScaler.Scale(scaledImg, scaledRect, img, img.Bounds(), draw.Src, nil)

	return scaledImg
}

// applyDithering applies a dithering algorithm to the image using image/draw
func applyDithering(img image.Image, cfg config.Dithering) (*image.Paletted, error) {
	if cfg.Colors > 256 || cfg.Colors < 2 {
		return nil, fmt.Errorf("invalid number of colors %d (must be between 2 and 256)", cfg.Colors)
	}

	bounds := img.Bounds()
	numColors := cfg.Colors

	// Select the drawer based on algorithm
	var drawer draw.Drawer
	switch cfg.Algorithm {
	case config.DitheringAlgorithmNone:
		drawer = draw.Src
	case config.DitheringAlgorithmFloydSteinberg:
		drawer = draw.FloydSteinberg
	default:
		return nil, fmt.Errorf("unknown dithering algorithm %q (supported: floyd-steinberg, none)", cfg.Algorithm)
	}

	// Create a grayscale palette with the specified number of colors
	// For numColors=2: [black, white]
	// For numColors=4: [black, dark gray, light gray, white]
	palette := make(color.Palette, numColors)
	for i := range numColors {
		// Distribute colors evenly across the grayscale range
		grayValue := uint8(i * 255 / (numColors - 1))
		palette[i] = color.Gray{Y: grayValue}
	}

	slog.Debug(
		"Applying image dithering",
		"algorithm", cfg.Algorithm,
		"numColors", numColors,
		"palette", palette)

	paletted := image.NewPaletted(bounds, palette)

	// Draw the source image onto the paletted image using the selected dithering algorithm
	drawer.Draw(paletted, bounds, img, image.Point{})

	if cfg.Inverted {
		// Reverse the palette to quickly invert our colors.
		slices.Reverse(paletted.Palette)
	}

	return paletted, nil
}

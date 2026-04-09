# eink-server frontend

A SvelteKit frontend that not only renders e-ink dashboards but also provides an API to generate dithered PNG screenshots of them using headless Chromium.

## Frameworks and Tools

- **SvelteKit** - Web framework
- **Vite** - Build tool
- **Playwright** - Headless browser automation for screenshots
- **Sharp** - High-performance image processing (downscaling, PNG encoding)
- **pnpm** - Package manager

## Endpoints

The frontend exposes the following routes:

- **`GET /dashboards/<id>`**
  Renders the HTML dashboard. Used by the browser and by the screenshot endpoint internally.
  Accepts a `?password=` query parameter if the dashboard is password-protected.

- **`GET /dashboards/<id>/screenshot.png`**
  Returns a fully rendered, dithered, 1-bit or grayscale PNG screenshot of the dashboard.
  Behind the scenes, this endpoint spawns a headless Chromium instance, navigates to the dashboard's HTML route, waits for the page to load, applies CSS filters, and processes the image using Floyd-Steinberg dithering or nearest-color quantization.
  Accepts a `?password=` query parameter if the dashboard is password-protected.

## Dashboard Configuration

Each dashboard has its own `config.json` file located at `src/routes/dashboards/<id>/config.json`. The base schema for every dashboard is:

```json
{
  "width": 800,
  "height": 480,
  "password": {
    "_file": "secrets/diamonds-desk-password",
    "_default": null
  },
  "screenshot": {
    "pageLoadDelay": 3000,
    "cssFilter": "grayscale(1)",
    "imageScale": 1,
    "dithering": {
      "algorithm": "none",
      "colors": 2
    }
  }
}
```

### Base Schema Details

- **`width` / `height`**: The logical viewport dimensions in pixels.
- **`password`**: Optional password protection. Supports `{"_file": "path", "_default": null}` to load secrets securely at runtime.
- **`screenshot.pageLoadDelay`**: Milliseconds to wait after the `<body>` is visible before taking the screenshot (useful for animations or slow fonts).
- **`screenshot.cssFilter`**: A raw CSS filter string injected into the `<body>` element before capture (e.g., `"grayscale(1)"`).
- **`screenshot.cssExtras`**: Additional raw CSS injected into a `<style>` block in the head.
- **`screenshot.imageScale`**: Viewport upscale factor. Captures at a higher resolution and uses high-quality Lanczos downscaling before dithering to reduce aliasing on thin lines.
- **`screenshot.dithering.algorithm`**: `"none"` for nearest-color quantization, or `"floyd-steinberg"` for error-diffusion dithering.
- **`screenshot.dithering.colors`**: Number of grayscale levels in the output palette (2 for pure black and white).

## Development

This project uses a Nix flake for development dependencies. We recommend using
[direnv](https://direnv.net/) for automatic environment loading:

```bash
# Allow direnv for this project
direnv allow

# Dependencies will be installed automatically
# Start the dev server
pnpm dev
```

### Without direnv

```bash
# Enter the Nix development shell
nix develop

# Dependencies will be installed automatically
# Start the dev server
pnpm dev
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm check` - Run Svelte type checking
- `pnpm format` - Format code with Prettier
- `pnpm lint` - Check code formatting

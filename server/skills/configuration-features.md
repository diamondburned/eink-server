# Configuration Features

## Global Settings

### defaultRefreshTime
- Global refresh interval for dashboards
- Can be overridden per-dashboard

### dataDir
- Where screenshots and metadata are stored
- Default: `./data`

### pageLoadDelaySec
- Seconds to wait after page load
- **IMPORTANT**: Uses seconds, not milliseconds!

## Dashboard-Specific Settings

### Per-Dashboard refreshTime
- Override global `defaultRefreshTime` for specific dashboards
- Allows different refresh schedules per dashboard

### CSS Filters
- Raw CSS filter string applied to screenshots
- Example: `"grayscale(1) brightness(1.2)"`
- Useful for adjusting contrast/brightness for eink displays

### Dithering
- Object format: `{algorithm: string, colors: int}`
- Supported algorithms: `"floyd-steinberg"`
- Color levels:
  - `2` colors: Black/white only
  - `4` colors: 4-level grayscale
  - `16` colors: 16-level grayscale
- Example: `{algorithm: "floyd-steinberg", colors: 4}`

### Headers and URL Parameters
- Direct specification: `headers` and `urlParams` objects
- File loading: `headersFromFile` and `urlParamsFromFile`
- Files are loaded relative to config file location

### Webhooks
- Trigger GET/POST requests before taking screenshots
- Supports custom headers and body
- Useful for waking up services or triggering updates

## Authentication

### passwordFile
- Password for query parameter authentication
- Access: `/dashboards/{id}.png?password=...`

### authTokenFile
- Token for Authorization header authentication
- Access with header: `Authorization: Bearer <token>`

## Example Configuration

```json
{
  "defaultRefreshTime": "5m",
  "dataDir": "./data",
  "pageLoadDelaySec": 2,
  "dashboards": {
    "diamonds-desk": {
      "url": "http://localhost:5173/dashboards/diamonds-desk",
      "width": 800,
      "height": 480,
      "cssFilter": "grayscale(1) brightness(1.2)",
      "dithering": {
        "algorithm": "floyd-steinberg",
        "colors": 4
      },
      "refreshTime": "10m"
    }
  }
}
```

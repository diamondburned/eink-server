# Home Assistant API Patterns

## Service Calls

### API Pattern

Use `callService()` method for calling Home Assistant services:

```typescript
callService(
  domain: string,
  service: string,
  data?: Record<string, any>,
  options?: { returnResponse?: boolean }
)
```

### Return Types

The method uses TypeScript overloads for conditional return types:

- **Without `returnResponse`**: Returns `ServiceCallStates` (EntityState[]) - the states that
  changed
- **With `returnResponse: true`**: Returns `ServiceCallResponse<T>` - includes both changed states
  and service response data

### Example: Weather Forecasts

```typescript
const response = await homeAssistant.callService<WeatherForecastResponse>(
  "weather",
  "get_forecasts",
  {
    entity_id: "weather.my_weather",
    type: "daily", // or "hourly" or "twice_daily"
  },
  { returnResponse: true },
);

// Response format:
// {
//   changed_states: EntityState[],
//   service_response: {
//     [entity_id]: {
//       forecast: WeatherForecast[]
//     }
//   }
// }
```

### Available Forecast Types

- `"hourly"` - Hourly forecast data
- `"daily"` - Daily forecast data
- `"twice_daily"` - Twice-daily forecast data

### Forecast Data Fields

The `WeatherForecast` interface includes:

- `datetime` - ISO timestamp
- `temperature` - Temperature (high for daily)
- `templow` - Low temperature (daily only)
- `condition` - Weather condition code
- `precipitation_probability` - % chance of precipitation
- `precipitation` - Amount of precipitation
- `pressure`, `humidity`, `wind_speed`, `wind_bearing`, etc.

## All-Day Event Date Handling

**Home Assistant uses exclusive end dates** for all-day events:

- An event from Jan 1-4 means it runs Jan 1, 2, and 3
- The end date is the day **after** the last day of the event
- Account for this when calculating event duration:

```typescript
// Calculate total days (accounting for exclusive end)
const totalDays = Math.max(1, differenceInCalendarDays(parseISO(event.end), parseISO(event.start)));
```

## Implementation Files

- **API Client**: `/src/lib/homeAssistant/index.ts`
  - `callService()` method with overloaded signatures
  - POST to `/api/services/<domain>/<service>`
  - Optional `?return_response` query parameter

- **Type Definitions**: `/src/lib/homeAssistant/types.ts`
  - `WeatherForecast` interface
  - `WeatherForecastType` type alias
  - `WeatherForecastResponse` type
  - `ServiceCallResponse<T>` interface
  - `ServiceCallStates` type alias

- **Data Utilities**: `/src/lib/homeAssistant/data.ts`
  - Weather condition formatting
  - Icon mappings for weather conditions

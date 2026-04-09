# Dashboard Implementation Patterns

## File Structure

Dashboard implementation follows a consistent pattern:

- **Route**: `/src/routes/dashboards/{dashboard-name}/+page.svelte`
- **Server Load**: `/src/routes/dashboards/{dashboard-name}/+page.server.ts`
- **Config**: `/src/routes/dashboards/{dashboard-name}/config.json`

## Server-Side Data Loading

Data fetching happens in `+page.server.ts`:

```typescript
import type { PageServerLoad } from './$types';
import { homeAssistant } from '$lib/homeAssistant';

export const load: PageServerLoad = async () => {
  // Fetch data from Home Assistant
  const weather = await homeAssistant.entityStates('weather.my_weather');
  const forecasts = await homeAssistant.callService(...);

  return {
    weather: {
      current: weather[0],
      forecastHourly: [...],
      forecastDaily: [...]
    }
  };
};
```

## Component Structure

Dashboard components (`+page.svelte`) follow this structure:

```svelte
<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // Derived/computed values
  const someValue = $derived(computeValue(data));

  // Helper functions
  function helperFunction(input) {
    // ...
  }
</script>

<!-- Markup -->
<div class="dashboard">
  <!-- sections -->
</div>

<style>
  /* Modern CSS with nesting */
  .dashboard {
    .section {
      /* nested styles */
    }
  }
</style>
```

## Common Patterns

### Weather Display

Current weather + forecast pattern:

```svelte
<!-- Current conditions -->
<div class="weather-current">
  <svg-icon path={weatherIcon} />
  <span>{temperature}°</span>
</div>

<!-- Forecast -->
<div class="weather-forecast">
  {#each data.weather.forecastDaily.slice(0, 5) as day}
    <div class="forecast-day">
      <div class="day-name">{formatDayName(day.datetime)}</div>
      <svg-icon path={getWeatherIcon(day.condition)} />
      <div class="temps">{day.temperature}° / {day.templow}°</div>
    </div>
  {/each}
</div>
```

### Calendar Events

Multi-day event handling:

```svelte
{#each allDayEvents as event}
  {@const dayInfo = getEventDayInfo(event)}
  <div class="event">
    <span class="summary">{event.summary}</span>
    {#if dayInfo.totalDays > 1}
      <span class="event-day-info">(Day {dayInfo.currentDay}/{dayInfo.totalDays})</span>
    {/if}
  </div>
{/each}
```

### Helper Functions

Day formatting:

```typescript
function formatDayName(isoString: string): string {
  const date = parseISO(isoString);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE"); // Mon, Tue, etc.
}
```

Event day calculation:

```typescript
function getEventDayInfo(event) {
  const start = parseISO(event.start);
  const end = parseISO(event.end);
  const now = startOfDay(new Date());

  // Account for Home Assistant's exclusive end dates
  const totalDays = Math.max(1, differenceInCalendarDays(end, start));

  // Calculate current day (1-indexed)
  const currentDay = Math.min(
    totalDays,
    Math.max(1, Math.floor(differenceInCalendarDays(now, start)) + 1),
  );

  return { currentDay, totalDays };
}
```

## Styling Guidelines

Font sizes use `em` units:

```css
.dashboard {
  font-size: 1em;

  .section-header {
    font-size: 1.2em; /* relative to parent */
  }

  .detail {
    font-size: 0.9em;
  }
}
```

Grayscale colors for e-ink:

```css
.element {
  color: #000;
  background: #fff;
  border-color: #ccc;
}

.subtle {
  color: #666; /* lighter gray for secondary info */
}
```

## Referenced Libraries

- `date-fns` - Date manipulation and formatting
  - `parseISO`, `format`, `isToday`, `isTomorrow`
  - `differenceInCalendarDays`, `startOfDay`
- `@mdi/js` - Material Design Icons
  - Import icon paths, use with `<svg-icon>`

// Utility functions for the Diamond's Desk dashboard.

export interface FormatTimeOptions {
  showMinutes?: boolean | "quarterly";
  show24HourTime: boolean;
}

// Formats a time string with optional minute display/rounding.
// Returns HTML string (may contain span tags for quarterly styling).
export function formatTime(isoString: string, options: FormatTimeOptions): string {
  const { showMinutes = true, show24HourTime } = options;
  let date = new Date(isoString);
  const isQuarterly = showMinutes === "quarterly";

  if (!showMinutes && !isQuarterly) {
    date = new Date(date.setMinutes(0, 0, 0));
  } else if (isQuarterly) {
    // Round to nearest 15 minutes
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    date = new Date(date.setMinutes(roundedMinutes, 0, 0));
  }

  let formatted = date.toLocaleTimeString("en-US", {
    hour: show24HourTime ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: !show24HourTime,
  });

  if (!showMinutes && !isQuarterly) {
    formatted = formatted.replace(
      /:\d{2}/,
      show24HourTime ? `<span class="hidden-minutes">:--</span>` : "",
    );
  } else if (isQuarterly) {
    // Wrap minutes in a span with class for styling
    formatted = formatted.replace(/:(\d{2})/, '<span class="quarterly-minutes">:$1</span>');
  }

  return formatted;
}

// Formats a duration between two dates.
// Returns formatted string like "2h 30m", "45m", etc.
export function formatDuration(start: string | Date, end: string | Date): string {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  const durationMs = endDate.getTime() - startDate.getTime();
  const minutes = Math.round(durationMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

// Formats a date as a day name (Today, Tomorrow, or weekday abbreviation).
export function formatDayName(isoString: string, currentDate: Date): string {
  const date = new Date(isoString);

  // Check if it's today
  if (date.toDateString() === currentDate.toDateString()) {
    return "Today";
  }

  // Check if it's tomorrow
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  }

  // Otherwise return the day of the week
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export interface EventDayInfo {
  currentDay: number;
  totalDays: number;
}

// Calculates which day of a multi-day event is currently being displayed.
// Returns null if event is single-day.
export function getEventDayInfo(
  event: { start: Date; end: Date },
  currentDate: Date,
): EventDayInfo | null {
  const eventStart = event.start;
  const eventEnd = event.end;

  // Set all times to start of day for day counting
  const todayStart = new Date(currentDate);
  todayStart.setHours(0, 0, 0, 0);

  const eventStartDay = new Date(eventStart);
  eventStartDay.setHours(0, 0, 0, 0);

  const eventEndDay = new Date(eventEnd);
  eventEndDay.setHours(0, 0, 0, 0);

  // Calculate total days (inclusive)
  // For all-day events, Home Assistant uses exclusive end dates (end date is the day after the last day)
  const totalDays = Math.max(
    1,
    Math.ceil((eventEndDay.getTime() - eventStartDay.getTime()) / (1000 * 60 * 60 * 24)),
  );

  // Only show day info if event spans multiple days
  if (totalDays <= 1) {
    return null;
  }

  // Calculate which day we're on (1-based)
  const currentDay = Math.min(
    totalDays,
    Math.max(
      1,
      Math.floor((todayStart.getTime() - eventStartDay.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    ),
  );

  return { currentDay, totalDays };
}

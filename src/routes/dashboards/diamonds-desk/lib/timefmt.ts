import type { CalendarEvent } from "./calendar";
import * as luxon from "luxon";

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
export function formatEventDuration(event: CalendarEvent): string {
  const start = luxon.DateTime.fromJSDate(event.start);
  const end = luxon.DateTime.fromJSDate(event.end);
  const duration = end.diff(start).rescale();

  let str = duration.toHuman({
    maximumFractionDigits: 0,
    roundingMode: "ceil",
    unitDisplay: "narrow",
    listStyle: "narrow",
  });
  return str;
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

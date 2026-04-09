import type { CalendarEvent as HACalendarEvent } from "./homeAssistant/types";

export interface CalendarEvent {
  summary: string | null;
  start: Date; // ISO string
  end: Date; // ISO string
  description?: string;
  isAllDay?: boolean;
}

export interface TimelineHour {
  time: string; // ISO string
  isPast: boolean;
  isCurrent: boolean;
}

export interface TimelineEvent extends CalendarEvent {
  // Position and size relative to timeline (percentage)
  offsetPercent: number; // Distance from timeline start
  heightPercent: number; // Height based on duration
  // Overlap information
  overlapColumn: number; // Which column this event is in (0-based)
  overlapTotal: number; // Total number of overlapping events at this time
}

// Parses Home Assistant calendar events into our CalendarEvent format.
// Returned events are automatically sorted by time.
export function parseCalendarEvents(
  haEvents: HACalendarEvent[],
  { placeholderSummary = "busy" }: { placeholderSummary?: string | null } = {},
): CalendarEvent[] {
  const events: CalendarEvent[] = haEvents.map((e) => parseCalendarEvent(e, placeholderSummary));
  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return events;
}

function parseCalendarEvent(
  haEvent: HACalendarEvent,
  placeholderSummary: string | null,
): CalendarEvent {
  const start = parseHADate(haEvent.start);
  const end = parseHADate(haEvent.end);
  return {
    summary: haEvent.summary || placeholderSummary,
    start,
    end,
    description: haEvent.description,
    isAllDay: !!haEvent.start.date || start.getDate() != end.getDate(),
  };
}

function parseHADate(date: { dateTime?: string; date?: string }): Date {
  if (date.dateTime) {
    return new Date(Date.parse(date.dateTime));
  } else if (date.date) {
    const tzOffsetMs = new Date().getTimezoneOffset() * 60 * 1000;
    return new Date(Date.parse(date.date) + tzOffsetMs);
  } else {
    return new Date();
  }
}

// Generates hour markers for the continuous timeline.
// startTime will be rounded down to the hour, endTime will be rounded up.
// Returns array of hour markers covering the time range.
export function generateTimelineHours(startTime: Date, endTime: Date, now: Date): TimelineHour[] {
  const hours: TimelineHour[] = [];

  // Round start time down to the hour
  const roundedStart = new Date(startTime);
  roundedStart.setMinutes(0, 0, 0);

  // Round end time up to the hour
  const roundedEnd = new Date(endTime);
  roundedEnd.setMinutes(0, 0, 0);
  roundedEnd.setHours(roundedEnd.getHours() + 1);

  const nowTime = now.getTime();

  // Generate hour markers from start to end
  let currentHour = new Date(roundedStart);
  while (currentHour <= roundedEnd) {
    const hourStart = currentHour.getTime();
    const hourEnd = hourStart + 60 * 60 * 1000;

    const isCurrent = hourStart <= nowTime && nowTime < hourEnd;
    const isPast = hourStart < nowTime && !isCurrent;

    hours.push({
      time: currentHour.toISOString(),
      isPast,
      isCurrent,
    });

    // Move to next hour
    currentHour = new Date(currentHour.getTime() + 60 * 60 * 1000);
  }

  return hours;
}

// Detects overlapping events and assigns them to columns.
function detectOverlaps(
  events: CalendarEvent[],
): Array<CalendarEvent & { overlapColumn: number; overlapTotal: number }> {
  const result: Array<CalendarEvent & { overlapColumn: number; overlapTotal: number }> = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventStart = event.start.getTime();
    const eventEnd = event.end.getTime();

    // Find all events that overlap with this one
    const overlapping: number[] = [i];
    for (let j = 0; j < events.length; j++) {
      if (i == j) {
        continue;
      }

      const otherStart = events[j].start.getTime();
      const otherEnd = events[j].end.getTime();

      if (otherEnd > eventStart && eventEnd > otherStart) {
        overlapping.push(j);
      }
    }

    // Find which column this event should be in
    // We need to check all overlapping events that start before this one
    const overlappingBefore = overlapping.filter((idx) => idx < i).map((idx) => result[idx]);

    let column = 0;
    const usedColumns = new Set(overlappingBefore.map((e) => e.overlapColumn));
    while (usedColumns.has(column)) {
      column++;
    }

    result.push({
      ...event,
      overlapColumn: column,
      overlapTotal: Math.max(
        ...overlapping.map((idx) => (idx < i ? result[idx].overlapTotal : 1)),
        overlapping.length,
      ),
    });
  }

  // Second pass: update overlapTotal for all events
  for (let i = 0; i < result.length; i++) {
    const event = result[i];
    const eventStart = event.start.getTime();
    const eventEnd = event.end.getTime();

    // Include this event's own column so that the highest-column event
    // in a group correctly counts itself toward the total.
    let maxColumn = event.overlapColumn;
    for (let j = 0; j < result.length; j++) {
      if (i === j) {
        continue;
      }

      const otherStart = result[j].start.getTime();
      const otherEnd = result[j].end.getTime();

      if (otherEnd > eventStart && eventEnd > otherStart) {
        maxColumn = Math.max(maxColumn, result[j].overlapColumn);
      }
    }

    result[i].overlapTotal = maxColumn + 1;
  }

  return result;
}

// Generates timeline events with positioning information for continuous timeline.
// timelineStart and timelineEnd should be rounded to the hour.
// Returns array of timeline events with positioning data.
export function generateTimelineEvents(
  timelineStart: Date,
  timelineEnd: Date,
  events: CalendarEvent[],
): TimelineEvent[] {
  // Filter out all-day events
  const timedEvents = events.filter((event) => !event.isAllDay);

  // Use the provided timeline bounds (already rounded)
  const timelineStartMs = timelineStart.getTime();
  const timelineEndMs = timelineEnd.getTime();
  const timelineDuration = timelineEndMs - timelineStartMs;

  // Detect overlaps
  const eventsWithOverlap = detectOverlaps(timedEvents);

  // Calculate positioning
  return eventsWithOverlap.map((event) => {
    const eventStart = event.start.getTime();
    const eventEnd = event.end.getTime();

    // Clamp event to visible timeline range
    const visibleStart = Math.max(eventStart, timelineStartMs);
    const visibleEnd = Math.min(eventEnd, timelineEndMs);

    const offsetPercent = ((visibleStart - timelineStartMs) / timelineDuration) * 100;
    const heightPercent = ((visibleEnd - visibleStart) / timelineDuration) * 100;

    return {
      ...event,
      offsetPercent,
      heightPercent,
    };
  });
}

function roundTimelinePercent(pct: number): number {
  return Math.round(pct * 1000) / 1000;
}

// Gets all-day events that are active today (before midnight).
export function getTodayAllDayEvents(now: Date, events: CalendarEvent[]): CalendarEvent[] {
  const midnight = new Date(now.setHours(24, 0, 0, 0));
  return events.filter((event) => {
    return event.isAllDay && event.start < midnight && now <= event.end;
  });
}

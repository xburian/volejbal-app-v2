import { SportEvent } from '../types';
import { startOfDay } from 'date-fns';

/**
 * Escape special characters for iCalendar text fields.
 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.11
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Convert date + time strings to iCalendar DTSTART/DTEND format (local time).
 * date: 'YYYY-MM-DD', time: 'HH:MM'
 * Returns 'YYYYMMDDTHHMMSS'
 */
function toICalDateTime(date: string, time: string): string {
  const [y, m, d] = date.split('-');
  const [h, min] = time.split(':');
  return `${y}${m}${d}T${h}${min}00`;
}

/**
 * Add hours to an iCal datetime string and return a new iCal datetime string.
 */
function addHoursToICalDateTime(icalDt: string, hours: number): string {
  // Parse: YYYYMMDDTHHMMSS
  const y = parseInt(icalDt.slice(0, 4), 10);
  const m = parseInt(icalDt.slice(4, 6), 10) - 1;
  const d = parseInt(icalDt.slice(6, 8), 10);
  const h = parseInt(icalDt.slice(9, 11), 10);
  const min = parseInt(icalDt.slice(11, 13), 10);
  const s = parseInt(icalDt.slice(13, 15), 10);

  const dt = new Date(y, m, d, h, min, s);
  dt.setHours(dt.getHours() + hours);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
}

/**
 * Generate an iCalendar (.ics) string from an array of SportEvents.
 * Only includes events on or after today.
 */
export function generateICS(events: SportEvent[]): string {
  const today = startOfDay(new Date());
  const upcoming = events.filter(e => new Date(e.date) >= today);

  const vevents = upcoming.map(event => {
    const dtStart = toICalDateTime(event.date, event.time);
    const dtEnd = addHoursToICalDateTime(dtStart, 2);
    const summary = escapeICalText(event.title);
    const location = escapeICalText(event.location);

    const descParts: string[] = [];
    if (event.totalCost > 0) descParts.push(`Celková cena: ${event.totalCost} Kč`);
    const joinedCount = (event.participants || []).filter(p => p.status === 'joined').length;
    if (joinedCount > 0) descParts.push(`Účastníků: ${joinedCount}`);
    if (event.description) descParts.push(event.description);
    const description = escapeICalText(descParts.join(' | '));

    return [
      'BEGIN:VEVENT',
      `UID:${event.id}@sport-planovac`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sport Plánovač//CZ',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Trigger a browser download of the upcoming events as an .ics file.
 */
export function downloadICS(events: SportEvent[]): void {
  const icsContent = generateICS(events);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'sport-planovac-kalendar.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


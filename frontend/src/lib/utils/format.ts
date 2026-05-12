import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/** Format a unix timestamp or ISO string as a human-readable date. */
export function formatDate(value: number | string, template = 'MMM D, YYYY'): string {
  return dayjs(typeof value === 'number' ? value * 1000 : value).format(template);
}

/** Format as relative time, e.g. "2 hours ago". */
export function fromNow(value: number | string): string {
  return dayjs(typeof value === 'number' ? value * 1000 : value).fromNow();
}

/** Format bytes to human-readable size. */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/** Truncate a string to maxLength, appending ellipsis if needed. */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}…`;
}

/** Generate initials from a full name (mirrors generateInitialsImage logic in Svelte utils). */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Capitalise first letter. */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

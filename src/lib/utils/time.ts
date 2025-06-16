const NOW = 5;
const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const MONTH = DAY * 30;

export function getTimeAgo(date: number | string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffSeconds < NOW) {
    return 'now';
  }
  if (diffSeconds < MINUTE) {
    return `${diffSeconds}s`;
  }
  if (diffSeconds < HOUR) {
    const minutes = Math.floor(diffSeconds / MINUTE);
    return `${minutes}m`;
  }
  if (diffSeconds < DAY) {
    const hours = Math.floor(diffSeconds / HOUR);
    return `${hours}h`;
  }
  if (diffSeconds < MONTH) {
    const days = Math.floor(diffSeconds / DAY);
    return `${days}d`;
  }
  
  // If older than a month, return the date
  return then.toLocaleDateString('en-us', {
    month: 'short',
    day: 'numeric'
  });
} 

// March 27, 2025 at 7:43 PM
export function getFormattedDate(date: number | string | Date): string {
  const then = new Date(date);
  return then.toLocaleDateString('en-us', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
} 

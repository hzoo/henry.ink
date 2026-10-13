const paths = {
  layout: 'M4 4h16v16H4z M4 9h16 M9 9v11',
  text: 'M4 5h16 M12 5v14 M8 19h8',
  external: 'M14 4h6v6 M20 4l-9 9 M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  panel: 'M4 4h16v16H4z M14 4v16',
  close: 'm6 6 12 12 M6 18 18 6',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M6.1 6.1A8 8 0 0 1 20 12 M4 12a8 8 0 0 0 13.9 5.9',
  comment: 'M20 4H4v13h4v4l5-4h7z',
  highlight: 'm8 15 8-11 5 4-8 11-5-4z M8 15l-3 5h8 M3 22h12',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  chevron: 'm9 5 7 7-7 7',
  arrow: 'M5 12h14 m-5-5 5 5-5 5',
  info: 'M12 11v6 M12 7v.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  list: 'M4 5h16 M4 10h16 M4 15h16 M4 20h16',
};

export function ReaderIcon({ name, class: className = '' }: { name: keyof typeof paths; class?: string }) {
  return <svg aria-hidden="true" focusable="false" class={`shrink-0 ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d={paths[name]} /></svg>;
}

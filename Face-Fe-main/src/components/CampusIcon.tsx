import type { CSSProperties } from 'react';
const paths: Record<string, string> = {
  home: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  camera: 'M8 5 10 3h4l2 2h4v15H4V5h4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  calendar: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4M8 13h2M14 13h2M8 17h2',
  history: 'M3 11a9 9 0 1 1 2 7M3 5v6h6M12 7v5l3 2',
  chart: 'M4 20h16M7 17v-5M12 17V6M17 17V9',
  check: 'm5 12 4 4L19 6',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',
  arrow: 'M4 12h16m-5-5 5 5-5 5',
  chevron: 'm9 5 7 7-7 7',
  logout: 'M9 4H4v16h5M11 12h10m-5-5 5 5-5 5',
  users: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 3a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-4',
  room: 'M4 21V3h12v18M16 8h4v13M9 8h2M9 12h2M9 16h2M2 21h20',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 1 0-2 7M20 4v7h-7',
};
export function CampusIcon({ name, style }: { name: string; style?: CSSProperties }) {
  return <svg style={style} className="campus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.home}/></svg>;
}

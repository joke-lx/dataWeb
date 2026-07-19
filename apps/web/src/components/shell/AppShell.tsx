import type { JSX } from 'react';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { StatusBar } from './StatusBar';
import './shell.css';

export function AppShell(): JSX.Element {
  return (
    <div className="app-shell">
      <TopBar />
      <LeftRail />
      <main className="stage-placeholder">中央 Stage — Task D 起实现</main>
      <StatusBar />
    </div>
  );
}
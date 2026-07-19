import type { JSX } from 'react';
import { Stage } from '../stage/Stage';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { StatusBar } from './StatusBar';
import './shell.css';

export function AppShell(): JSX.Element {
  return (
    <div className="app-shell">
      <TopBar />
      <LeftRail />
      <Stage />
      <StatusBar />
    </div>
  );
}
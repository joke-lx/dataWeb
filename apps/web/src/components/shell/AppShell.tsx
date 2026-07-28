import type { JSX, ReactNode } from 'react';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import './shell.css';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="app-shell__main">{children}</main>
      <StatusBar />
    </div>
  );
}
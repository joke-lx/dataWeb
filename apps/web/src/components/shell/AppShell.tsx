import { useRef } from 'react';
import type { JSX, ReactNode } from 'react';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { useD3Zoom } from '../../hooks/useD3Zoom';
import './shell.css';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  const mainRef = useRef<HTMLElement>(null);
  useD3Zoom(mainRef);

  return (
    <div className="app-shell">
      <TopBar />
      <main className="app-shell__main" ref={mainRef}>{children}</main>
      <StatusBar />
    </div>
  );
}
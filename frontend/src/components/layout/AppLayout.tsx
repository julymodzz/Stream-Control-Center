import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <footer className="border-t border-gray-700/50 py-3 text-center text-xs text-gray-500">
        Stream Control Center v2.0 · Live via WebSocket
      </footer>
    </div>
  );
}

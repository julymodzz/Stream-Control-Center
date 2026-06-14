import { useEffect, useMemo, useRef, useState } from 'react';
import { getLogDownloadUrl } from '../../api/client';
import { useDashboardStore } from '../../store/useDashboardStore';
import { LogEntry } from '../../types';

const EMPTY_LINES: LogEntry[] = [];

interface LogViewerProps {
  source: 'obs' | 'noalbs' | 'app';
  title: string;
}

export function LogViewer({ source, title }: LogViewerProps) {
  const logs = useDashboardStore((s) =>
    source === 'obs' ? s.obsLogs : source === 'noalbs' ? s.noalbsLogs : null
  );
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const filteredLines = useMemo(() => {
    if (!logs) return EMPTY_LINES;
    if (!search.trim()) return logs.lines;
    const query = search.toLowerCase();
    return logs.lines.filter((entry) => entry.line.toLowerCase().includes(query));
  }, [logs, search]);

  const lineCount = filteredLines.length;

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lineCount, autoScroll]);

  return (
    <div className="card flex flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Logs durchsuchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-600 bg-surface px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-accent-blue focus:outline-none"
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-gray-600"
            />
            Auto-Scroll
          </label>
          <a href={getLogDownloadUrl(source)} download className="btn-ghost text-xs">
            Download
          </a>
        </div>
      </div>

      <div
        ref={containerRef}
        className="max-h-64 flex-1 overflow-y-auto rounded-lg bg-black/40 p-3 font-mono text-xs leading-relaxed"
      >
        {!logs ? (
          <p className="text-gray-500">Logs werden geladen…</p>
        ) : lineCount === 0 ? (
          <p className="text-gray-500">Keine Log-Einträge gefunden.</p>
        ) : (
          filteredLines.map((entry, i) => (
            <div key={i} className="whitespace-pre-wrap break-all text-gray-300 hover:bg-white/5">
              {entry.timestamp && (
                <span className="mr-2 text-gray-500">[{entry.timestamp}]</span>
              )}
              {entry.line}
            </div>
          ))
        )}
      </div>

      {logs && (
        <p className="mt-2 text-xs text-gray-500">
          {lineCount} von {logs.totalLines} Zeilen
          {search && ' (gefiltert)'}
        </p>
      )}
    </div>
  );
}

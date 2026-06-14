import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useHealthInfo(): { mockMode: boolean } {
  const [mockMode, setMockMode] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.json())
      .then((data) => setMockMode(Boolean(data.mockMode)))
      .catch(() => {});
  }, []);

  return { mockMode };
}

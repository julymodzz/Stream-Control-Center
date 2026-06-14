import path from 'path';
import { config } from '../config/env';

export function procFile(filename: string): string {
  return path.join(config.procPath, filename);
}

import type { Candidate, Place } from '@parkbusan/shared';

export interface MapProps {
  dest: Place;
  items: Candidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

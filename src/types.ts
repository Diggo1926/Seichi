export type PlaceStatus = 'quero_visitar' | 'visitei' | 'quero_voltar';

export interface Place {
  id: string;
  createdAt: number;
  updatedAt: number;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  status: PlaceStatus;
  rating: number | null;
  notes: string;
  tags: string[];
  instagramUrl?: string;
  isDraft: boolean;
  coverPhotoId?: string;
}

export interface Photo {
  id: string;
  placeId: string;
  blob: Blob;
  thumbBlob: Blob;
  createdAt: number;
}

export interface Tag {
  id: string;
  label: string;
  builtin: boolean;
}

export const STATUS_META: Record<PlaceStatus, { label: string; color: string; soft: string; var: string }> = {
  quero_visitar: { label: 'Quero visitar', color: 'var(--color-indigo)', soft: 'var(--color-indigo-soft)', var: 'indigo' },
  visitei: { label: 'Visitei', color: 'var(--color-menta)', soft: 'var(--color-menta-soft)', var: 'menta' },
  quero_voltar: { label: 'Quero voltar', color: 'var(--color-coral)', soft: 'var(--color-coral-soft)', var: 'coral' },
};

export const RATING_LABELS: Record<number, string> = {
  1: 'Eu moraria aqui',
  2: 'Voltaria com alguém',
  3: 'Vale a visita',
  4: 'Deu pro gasto',
  5: 'Nem chego perto',
};

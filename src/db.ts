import Dexie, { type Table } from 'dexie';
import { v4 as uuid } from 'uuid';
import type { Place, Photo, Tag } from './types';

class SeichiDB extends Dexie {
  places!: Table<Place, string>;
  photos!: Table<Photo, string>;
  tags!: Table<Tag, string>;

  constructor() {
    super('seichi');
    this.version(1).stores({
      places: 'id, status, isDraft, createdAt, name',
      photos: 'id, placeId, createdAt',
      tags: 'id, builtin',
    });
  }
}

export const db = new SeichiDB();

const BUILTIN_TAGS = ['Sozinho', 'Romântico', 'Amigos', 'Família'];

export async function ensureBuiltinTags() {
  // Envolvido numa transação para o check-then-insert ser atômico: sem isso,
  // duas chamadas concorrentes (ex.: StrictMode invocando o efeito duas vezes)
  // podiam ver a contagem zerada ao mesmo tempo e duplicar as tags fixas.
  await db.transaction('rw', db.tags, async () => {
    const count = await db.tags.count();
    if (count > 0) return;
    await db.tags.bulkAdd(
      BUILTIN_TAGS.map((label) => ({ id: uuid(), label, builtin: true }))
    );
  });
}

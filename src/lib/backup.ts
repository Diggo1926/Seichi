import JSZip from 'jszip';
import { db } from '../db';
import type { Place, Tag } from '../types';

interface PhotoMeta {
  id: string;
  placeId: string;
  createdAt: number;
  file: string;
  thumbFile: string;
}

interface BackupJson {
  version: 1;
  exportedAt: number;
  places: Place[];
  tags: Tag[];
  photos: PhotoMeta[];
}

export async function exportBackup(): Promise<void> {
  const [places, tags, photos] = await Promise.all([
    db.places.toArray(),
    db.tags.toArray(),
    db.photos.toArray(),
  ]);

  const zip = new JSZip();
  const photosFolder = zip.folder('photos')!;
  const photoMetas: PhotoMeta[] = [];

  for (const photo of photos) {
    const file = `${photo.id}.jpg`;
    const thumbFile = `${photo.id}_thumb.jpg`;
    photosFolder.file(file, photo.blob);
    photosFolder.file(thumbFile, photo.thumbBlob);
    photoMetas.push({
      id: photo.id,
      placeId: photo.placeId,
      createdAt: photo.createdAt,
      file: `photos/${file}`,
      thumbFile: `photos/${thumbFile}`,
    });
  }

  const json: BackupJson = {
    version: 1,
    exportedAt: Date.now(),
    places,
    tags,
    photos: photoMetas,
  };

  zip.file('seichi.json', JSON.stringify(json, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `seichi-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<{ places: number; photos: number; tags: number }> {
  const zip = await JSZip.loadAsync(file);
  const jsonEntry = zip.file('seichi.json');
  if (!jsonEntry) throw new Error('Arquivo de backup inválido: seichi.json não encontrado.');

  const data = JSON.parse(await jsonEntry.async('string')) as BackupJson;

  let placesWritten = 0;
  let tagsWritten = 0;
  let photosWritten = 0;

  for (const place of data.places) {
    const existing = await db.places.get(place.id);
    if (!existing || existing.updatedAt < place.updatedAt) {
      await db.places.put(place);
      placesWritten++;
    }
  }

  for (const tag of data.tags) {
    const existing = await db.tags.get(tag.id);
    if (!existing) {
      await db.tags.put(tag);
      tagsWritten++;
    }
  }

  for (const meta of data.photos) {
    const existing = await db.photos.get(meta.id);
    if (existing) continue;
    const fileEntry = zip.file(meta.file);
    const thumbEntry = zip.file(meta.thumbFile);
    if (!fileEntry || !thumbEntry) continue;
    const [blob, thumbBlob] = await Promise.all([
      fileEntry.async('blob'),
      thumbEntry.async('blob'),
    ]);
    await db.photos.put({
      id: meta.id,
      placeId: meta.placeId,
      createdAt: meta.createdAt,
      blob,
      thumbBlob,
    });
    photosWritten++;
  }

  return { places: placesWritten, photos: photosWritten, tags: tagsWritten };
}

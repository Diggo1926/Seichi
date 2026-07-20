import { useEffect, useState } from 'react';
import { db } from '../db';

export function usePhotoUrl(photoId: string | undefined, variant: 'full' | 'thumb' = 'full') {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    if (!photoId) {
      setUrl(undefined);
      return;
    }

    db.photos.get(photoId).then((photo) => {
      if (!active || !photo) return;
      const blob = variant === 'full' ? photo.blob : photo.thumbBlob;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId, variant]);

  return url;
}

export function useBlobUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url;
}

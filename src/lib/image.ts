export interface ProcessedImage {
  full: Blob;
  thumb: Blob;
}

function resizeToBlob(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D não disponível');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem'))),
      'image/jpeg',
      quality
    );
  });
}

export async function processImage(source: Blob): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(source);
  try {
    const [full, thumb] = await Promise.all([
      resizeToBlob(bitmap, 1600, 0.7),
      resizeToBlob(bitmap, 480, 0.7),
    ]);
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}

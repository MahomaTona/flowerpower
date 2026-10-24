// Fotos klein rechnen, bevor sie an die Gruppe verteilt werden.

export async function compressImage(file: Blob, maxSide = 1024, maxBytes = 200_000): Promise<Uint8Array> {
  const bmp = await createImageBitmap(file)
  let side = maxSide
  let quality = 0.78
  for (let i = 0; i < 6; i++) {
    const scale = Math.min(1, side / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', quality))
    if (blob.size <= maxBytes || i === 5) return new Uint8Array(await blob.arrayBuffer())
    quality = Math.max(0.5, quality - 0.1)
    side = Math.round(side * 0.85)
  }
  throw new Error('unerreichbar')
}

const urls = new Map<Uint8Array, string>()
export function photoUrl(bytes: Uint8Array | undefined): string | undefined {
  if (!bytes) return undefined
  let u = urls.get(bytes)
  if (!u) {
    u = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'image/jpeg' }))
    urls.set(bytes, u)
  }
  return u
}

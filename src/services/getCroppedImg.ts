// Utility to crop image using canvas
// Usage: getCroppedImg(imageSrc, croppedAreaPixels) => Promise<string>

export default function getCroppedImg(imageSrc: string, crop: { x: number; y: number; width: number; height: number; }): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      );
      resolve(canvas.toDataURL('image/jpeg'));
    };
    image.onerror = reject;
  });
}

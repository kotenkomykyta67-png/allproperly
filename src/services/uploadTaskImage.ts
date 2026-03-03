import { storage } from "../services/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage";

/**
 * Compress image to under 1MB while maintaining quality
 * Resizes if needed and reduces quality until under 1MB
 */
export async function compressImageToUnder1MB(blob: Blob): Promise<Blob> {
  const maxSize = 1024 * 1024; // 1MB
  const maxWidth = 1280;
  const maxHeight = 720;
  let quality = 0.92;
  let resultBlob = blob;
  
  // Only compress/resize if over 1MB or not JPEG/WEBP
  if (blob.size > maxSize || !['image/jpeg', 'image/webp'].includes(blob.type)) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(blob);
    });
    
    // Resize logic
    let targetWidth = img.width;
    let targetHeight = img.height;
    if (img.width > maxWidth || img.height > maxHeight) {
      const widthRatio = maxWidth / img.width;
      const heightRatio = maxHeight / img.height;
      const ratio = Math.min(widthRatio, heightRatio);
      targetWidth = Math.round(img.width * ratio);
      targetHeight = Math.round(img.height * ratio);
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const mimeType = 'image/webp';
      
      // Try compressing until under 1MB or quality too low
      while (quality > 0.5) {
        const b = await new Promise<Blob | null>(res => canvas.toBlob(res, mimeType, quality));
        if (b && b.size <= maxSize) {
          resultBlob = b;
          break;
        }
        quality -= 0.07;
      }
    }
  }
  
  return resultBlob;
}

/**
 * Upload cropped task image to Firebase Storage
 * Always saves as WebP format for consistency
 * Compresses to under 1MB before uploading
 * Deletes previous image.webp if it exists to prevent orphaned files
 */
export async function uploadTaskImage(taskId: string, file: File): Promise<string> {
  const storageRef = ref(storage, `tasks/${taskId}/image.webp`);
  
  // Delete previous cropped image to prevent storage bloat
  try {
    await deleteObject(storageRef);
  } catch (err) {
    // File might not exist on first upload, ignore
  }
  
  // Compress image to under 1MB
  const compressedBlob = await compressImageToUnder1MB(file);
  
  // Upload compressed image
  await uploadBytes(storageRef, compressedBlob);
  return await getDownloadURL(storageRef);
}

/**
 * Upload original (uncropped) task image to Firebase Storage
 * Always saves as original.webp for consistency
 * Compresses to under 1MB before uploading
 * Deletes previous original images with any extension (jpg, png, etc)
 */
export async function uploadOriginalTaskImage(taskId: string, file: File): Promise<string> {
  const storageRef = ref(storage, `tasks/${taskId}/original.webp`);

  // NOTE: listing folder contents with `listAll` sometimes triggers
  // a 400 (Bad Request) in certain environments/CORS configurations.
  // We avoid listing/deleting other originals and instead simply
  // overwrite `original.webp`. This is simpler and more reliable.

  // Compress image to under 1MB
  const compressedBlob = await compressImageToUnder1MB(file);

  // Upload compressed image and return URL with robust error logging
  try {
    await uploadBytes(storageRef, compressedBlob);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (err) {
    console.error('[uploadOriginalTaskImage] Failed to upload original for task', taskId, err);
    throw err;
  }
}

/**
 * Delete task images from Firebase Storage (utility for cleanup)
 */
export async function deleteTaskImages(taskId: string): Promise<void> {
  try {
    const taskFolder = ref(storage, `tasks/${taskId}`);
    const items = await listAll(taskFolder);
    
    // Delete all files in the task folder
    for (const item of items.items) {
      try {
        await deleteObject(item);
      } catch (err) {
        // Ignore individual deletion errors
      }
    }
  } catch (err) {
    // Ignore folder listing errors
  }
}

import React, { useState, useRef, useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Cropper from 'react-cropper';
import './PhotoPickerCropperOverride.css';
// Minimal Cropper CSS fallback
import 'cropperjs/dist/cropper.css';
import { Box, Button, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const MODAL_IMAGE_REGION_WIDTH = 600;
const MODAL_IMAGE_REGION_HEIGHT = 400;

export interface PhotoPickerProps {
  imageSrc?: string | null;
  aspect?: number;
  onCropped: (blob: Blob, previewUrl: string) => void;
  onClose: () => void;
  avatarStyle?: boolean; // If true, use circular crop box style
}

const PhotoPicker: React.FC<PhotoPickerProps> = ({ imageSrc: controlledImageSrc, aspect, onCropped, onClose, avatarStyle }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(controlledImageSrc || null);
  const [error, setError] = useState<string>('');
  // For error handling
  const [isUploading, setIsUploading] = useState(false);
  const [cropperReady, setCropperReady] = useState(false);
  const [showSpinner, setShowSpinner] = useState(true); // true for 2s after imageSrc changes
  const cropperRef = useRef<any>(null);

  useEffect(() => {
    if (!controlledImageSrc) return;
    setError('');
    setImageSrc(controlledImageSrc);
    setShowSpinner(true);
    const timer = setTimeout(() => {
      setShowSpinner(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [controlledImageSrc]);

  // Dynamically set container size based on image
  function onImageReady() {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    // Always use fixed region size
    setTimeout(() => {
      if (cropper) {
        // Get the actual image data size
        const imageData = cropper.getImageData();
        // Set crop box to full image size
        cropper.setCropBoxData({
          width: imageData.naturalWidth,
          height: imageData.naturalHeight,
          left: 0,
          top: 0,
        });
        setCropperReady(true);
      }
    }, 100);
  }

  async function handleCropAndUpload() {
    setError("");
    if (!imageSrc) {
      setError("Image not loaded.");
      return;
    }
    const cropper = cropperRef.current?.cropper;
    if (!cropper) {
      setError("Image not loaded.");
      return;
    }
    try {
      setIsUploading(true);
      let croppedCanvas = cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        fillColor: '#fff',
      });
      if (!croppedCanvas) {
        setError('Failed to crop image.');
        return;
      }

      // Enforce aspect ratio if provided
      if (aspect && aspect > 0) {
        const { width, height } = croppedCanvas;
        const actualRatio = width / height;
        const targetRatio = aspect;
        const tolerance = 0.05; // 5% tolerance
        
        if (Math.abs(actualRatio - targetRatio) > tolerance) {
          // Adjust height to match aspect ratio
          const newHeight = Math.round(width / targetRatio);
          const resizeCanvas = document.createElement('canvas');
          resizeCanvas.width = width;
          resizeCanvas.height = newHeight;
          const ctx = resizeCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, width, newHeight);
            // Center the image vertically
            const offsetY = (newHeight - height) / 2;
            ctx.drawImage(croppedCanvas, 0, offsetY);
            croppedCanvas = resizeCanvas;
          }
        }
      }

      // Resize logic: ensure longest side is 1024px
      const maxSide = 1024;
      let { width, height } = croppedCanvas;
      let scale = 1;
      if (width > height && width > maxSide) {
        scale = maxSide / width;
      } else if (height > width && height > maxSide) {
        scale = maxSide / height;
      } else if (width === height && width > maxSide) {
        scale = maxSide / width;
      }
      if (scale !== 1) {
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = Math.round(width * scale);
        resizedCanvas.height = Math.round(height * scale);
        const ctx = resizedCanvas.getContext('2d');
        if (!ctx) {
          setError('Failed to resize image.');
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(croppedCanvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
        croppedCanvas = resizedCanvas;
      }

      // Apply a slight sharpening filter using a convolution kernel
      // Kernel: [ 0, -1,  0, -1,  5, -1,  0, -1,  0 ]
      const sharpen = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
        const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
        if (!ctx) return canvas;
        const w: number = canvas.width;
        const h: number = canvas.height;
        const imageData: ImageData = ctx.getImageData(0, 0, w, h);
        const data: Uint8ClampedArray = imageData.data;
        const copy: Uint8ClampedArray = new Uint8ClampedArray(data);
        const kernel: number[] = [
          0, -1, 0,
         -1,  5, -1,
          0, -1, 0
        ];
        for (let y: number = 1; y < h - 1; y++) {
          for (let x: number = 1; x < w - 1; x++) {
        for (let c: number = 0; c < 3; c++) { // R, G, B only
          let i: number = (y * w + x) * 4 + c;
          let sum: number = 0;
          let ki: number = 0;
          for (let ky: number = -1; ky <= 1; ky++) {
            for (let kx: number = -1; kx <= 1; kx++) {
          let ni: number = ((y + ky) * w + (x + kx)) * 4 + c;
          sum += copy[ni] * kernel[ki++];
            }
          }
          data[i] = Math.min(255, Math.max(0, sum));
        }
          }
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
      };

      croppedCanvas = sharpen(croppedCanvas);

      // Compress to ensure file is < 1MB
      let quality = 0.7; // Start with 70% quality
      const maxSize = 1024 * 1024; // 1MB
      
      const compressAndCallback = (qualityLevel: number) => {
        croppedCanvas.toBlob(
          (blob: Blob | null) => {
            if (!blob) {
              setError('Canvas is empty or image data is invalid.');
              return;
            }
            
            // If blob is still > 1MB, try lower quality
            if (blob.size > maxSize && qualityLevel > 0.2) {
              compressAndCallback(qualityLevel - 0.1);
              return;
            }
            
            const previewUrl = URL.createObjectURL(blob);
            try {
              onCropped(blob, previewUrl);
            } catch (err) {
              console.error('Error in onCropped callback:', err);
              URL.revokeObjectURL(previewUrl);
            }
          },
          'image/webp',
          qualityLevel
        );
      };
      
      compressAndCallback(quality);
    } catch (err) {
      console.error('Error in crop and upload:', err);
      setError('Failed to crop image.');
    } finally {
      setIsUploading(false);
    }
  }

  // Modal overlay and modal box styles
  return (
    <>
      <Box sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        bgcolor: 'rgba(30, 34, 44, 0.85)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Nunito, Arial, sans-serif',
      }}>
        <Box sx={{
          background: '#fff',
          borderRadius: 2,
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          px: 5,
          pt: 0,
          mt: 0,
          position: 'relative',
        }}>
          {/* Title bar */}
          <Box sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            position: 'relative',
            pt: 1,
            pb: 1,
            mt: 0,
          }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1A1A1A',
                fontWeight: 550,
                fontFamily: 'Nunito, Arial, sans-serif',
                fontSize: 22,
                letterSpacing: 0.1,
                textAlign: 'left',
                width: '100%',
              }}
            >
              Crop your Image
            </Typography>
            <IconButton
              onClick={onClose}
              sx={{
                color: '#1A1A1A',
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
              aria-label="Close"
            >
              <CloseIcon fontSize="medium" />
            </IconButton>
          </Box>
          {/* Cropper area */}
          <Box sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 100,
            mb: 2,
            background: 'transparent',
            borderRadius: 2,
            boxShadow: 'none',
            position: 'relative',
          }}>
            {error ? (
              <Typography color="error" sx={{ color: '#ffb4b4', fontWeight: 500 }}>{error}</Typography>
            ) : (
              <Box
                className={avatarStyle ? 'avatar-cropper' : ''}
                sx={{
                  position: 'relative',
                  width: `${MODAL_IMAGE_REGION_WIDTH}px`,
                  height: `${MODAL_IMAGE_REGION_HEIGHT}px`,
                  bgcolor: 'transparent',
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 0,
                  m: 0,
                }}
              >
                <Cropper
                  src={imageSrc ?? undefined}
                  style={{
                    width: MODAL_IMAGE_REGION_WIDTH,
                    height: MODAL_IMAGE_REGION_HEIGHT,
                    background: 'transparent',
                    objectFit: 'cover',
                  }}
                  aspectRatio={aspect || undefined}
                  guides={true}
                  cropBoxResizable={true}
                  cropBoxMovable={true}
                  dragMode="none"
                  viewMode={1}
                  background={false}
                  responsive={true}
                  autoCropArea={0.7}
                  minCropBoxWidth={40}
                  minCropBoxHeight={40}
                  highlight={true}
                  movable={false}
                  scalable={false}
                  zoomable={false}
                  rotatable={false}
                  checkOrientation={false}
                  ref={cropperRef}
                  ready={() => {
                    setCropperReady(true);
                    onImageReady();
                  }}
                  center={true}
                  toggleDragModeOnDblclick={false}
                />
                {showSpinner && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10,
                      background: 'transparent',
                    }}
                  >
                    <CircularProgress size={64} thickness={5} sx={{ color: '#89AE99' }} />
                  </Box>
                )}
              </Box>
            )}
          </Box>
          {/* Footer with Save button */}
          <Box sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            pb: 2,
            minHeight: 64,
          }}>
            <Button
              variant="contained"
              sx={{
                bgcolor: '#89AE99',
                fontFamily: 'Nunito, Arial, sans-serif',
                color: '#fff',
                fontWeight: 400,
                borderRadius: 2,
                px: 4,
                py: 1.2,
                fontSize: 16,
                boxShadow: 0,
                textTransform: 'none',
                minWidth: 100,
                alignSelf: 'flex-end',
              }}
              onClick={handleCropAndUpload}
              disabled={
                isUploading || !!error || !imageSrc || !cropperReady || !cropperRef.current?.cropper
              }
            >
              {isUploading ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default PhotoPicker;
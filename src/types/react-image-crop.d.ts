// TypeScript declaration for react-image-crop (minimal, for project use)
declare module 'react-image-crop' {
  import * as React from 'react';
  export interface Crop {
    unit?: 'px' | '%';
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    aspect?: number;
  }
  export interface ReactCropProps {
    crop: Crop | undefined;
    onChange: (crop: Crop) => void;
    onComplete?: (crop: Crop) => void;
    aspect?: number;
    minWidth?: number;
    minHeight?: number;
    keepSelection?: boolean;
    locked?: boolean;
    circularCrop?: boolean;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }
  const ReactCrop: React.FC<ReactCropProps>;
  export default ReactCrop;
}

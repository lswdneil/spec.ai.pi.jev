import { X } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

export interface ImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'width' | 'height'> {
  width?: number | string;
  height?: number | string;
  /** Click the image to open a full-window preview. */
  preview?: boolean | { src?: string };
  fallback?: string;
}

const ImageBase = React.forwardRef<HTMLImageElement, ImageProps>(function Image(
  { className, style, width, height, preview, fallback, src, alt, onClick, onError, ...props },
  ref
) {
  const [open, setOpen] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const previewSrc = typeof preview === 'object' && preview?.src ? preview.src : src;
  const shown = failed && fallback ? fallback : src;
  return (
    <>
      <img
        ref={ref}
        src={shown}
        alt={alt}
        width={width}
        height={height}
        className={cn(preview && 'cursor-pointer', className)}
        style={style}
        onClick={(event) => {
          onClick?.(event);
          if (preview) setOpen(true);
        }}
        onError={(event) => {
          setFailed(true);
          onError?.(event);
        }}
        {...props}
      />
      {open && previewSrc && typeof document !== 'undefined'
        ? createPortal(
            <div
              role='dialog'
              aria-modal='true'
              aria-label='Image preview'
              className='fixed inset-0 z-[100] flex items-center justify-center bg-[var(--sv-scrim)] p-6'
              onClick={() => setOpen(false)}
            >
              <button
                type='button'
                aria-label='Close preview'
                className='absolute right-4 top-4 flex h-8 w-8 bg-transparent items-center justify-center rounded-full border border-sv-line-strong text-sv-text outline-none hover:bg-sv-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus'
                onClick={() => setOpen(false)}
              >
                <X className='sv-icon-md' strokeWidth={1.75} />
              </button>
              <img
                src={previewSrc}
                alt={alt}
                className='max-h-full max-w-full object-contain'
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
});

export interface ImagePreviewGroupProps {
  actionsLayout?: string[];
  className?: string;
  children?: React.ReactNode;
}

const ImagePreviewGroup: React.FC<ImagePreviewGroupProps> = ({ children }) => <>{children}</>;

type ImageComponent = typeof ImageBase & { PreviewGroup: typeof ImagePreviewGroup };

export const Image = Object.assign(ImageBase, { PreviewGroup: ImagePreviewGroup }) as ImageComponent;

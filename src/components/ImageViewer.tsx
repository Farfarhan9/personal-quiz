import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../lib/data';
import type { QuizImage } from '../types';

interface ImageDialogProps {
  image: QuizImage | null;
  onClose: () => void;
}

/** Full-screen image viewer built on the native <dialog> element (Esc to close, focus trapped by the browser). */
export function ImageDialog({ image, onClose }: ImageDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (image && !dialog.open) {
      dialog.showModal();
    } else if (!image && dialog.open) {
      dialog.close();
    }
  }, [image]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className="image-dialog"
      aria-label={image ? `Enlarged image: ${image.alt}` : 'Enlarged image'}
      onClick={(e) => {
        // Tapping the dark backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {image && (
        <div className="image-dialog__inner">
          <button type="button" className="icon-btn image-dialog__close" onClick={onClose} aria-label="Close image">
            <span aria-hidden="true">✕</span>
          </button>
          <div className="image-dialog__scroll">
            <img src={assetUrl(image.src)} alt={image.alt} className="image-dialog__img" />
          </div>
          {(image.caption || image.alt) && <p className="image-dialog__caption">{image.caption ?? image.alt}</p>}
        </div>
      )}
    </dialog>
  );
}

interface ZoomableImageProps {
  image: QuizImage;
  className?: string;
}

/** A responsive image that opens full-screen when tapped. */
export function ZoomableImage({ image, className }: ZoomableImageProps) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`img-fallback ${className ?? ''}`} role="img" aria-label={image.alt}>
        <span aria-hidden="true">🖼️</span> Image unavailable: {image.alt}
      </div>
    );
  }

  return (
    <figure className={`zoom-figure ${className ?? ''}`}>
      <button type="button" className="zoom-trigger" onClick={() => setOpen(true)} aria-label={`Enlarge image: ${image.alt}`}>
        <img
          src={assetUrl(image.src)}
          alt={image.alt}
          className="responsive-img"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
        <span className="zoom-hint" aria-hidden="true">
          🔍 Tap to enlarge
        </span>
      </button>
      {image.caption && <figcaption className="zoom-caption">{image.caption}</figcaption>}
      <ImageDialog image={open ? image : null} onClose={() => setOpen(false)} />
    </figure>
  );
}

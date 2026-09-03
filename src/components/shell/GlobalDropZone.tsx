'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';

/**
 * Paste a URL anywhere → capture opens pre-filled. Drag a file onto any window →
 * capture opens with the file attached. Both are shell-level so every route
 * inherits them without opting in.
 */
export function GlobalDropZone() {
  const openModal = useApp((s) => s.openModal);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /input|textarea/i.test(target.tagName))) return;
      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (text && /^https?:\/\/\S+$/i.test(text)) {
        e.preventDefault();
        openModal('capture', text);
      }
    }

    let depth = 0;
    function onDragEnter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return;
      depth++;
      setDragging(true);
    }
    function onDragLeave() {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    }
    function onDragOver(e: DragEvent) {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    }
    async function onDrop(e: DragEvent) {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer.files[0]!;
      const text = file.type.startsWith('text/') ? await file.text() : '';
      openModal('capture', text || `Attached ${file.name}`);
    }

    window.addEventListener('paste', onPaste);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [openModal]);

  if (!dragging) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-scrim">
      <span className="t-heading-sm rounded-md border border-hairline-strong bg-canvas px-lg py-md shadow-modal">
        Drop to capture
      </span>
    </div>
  );
}

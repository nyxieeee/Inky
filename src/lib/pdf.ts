// Inky PDF Utilities (matching Worklane lib/ structure)
import { PDFDocument } from 'pdf-lib';

export interface PageDimensions {
  width: number;
  height: number;
  pageNumber: number;
}

/**
 * Normalizes screen drag/drop coordinates to percentage values (0-100)
 */
export function calculateNormalizedCoords(
  clientX: number,
  clientY: number,
  containerRect: DOMRect
): { x: number; y: number } {
  const relativeX = clientX - containerRect.left;
  const relativeY = clientY - containerRect.top;

  const pctX = Math.max(0, Math.min(100, (relativeX / containerRect.width) * 100));
  const pctY = Math.max(0, Math.min(100, (relativeY / containerRect.height) * 100));

  return {
    x: Number(pctX.toFixed(2)),
    y: Number(pctY.toFixed(2)),
  };
}

/**
 * Inspects PDF page count and sizes using pdf-lib
 */
export async function getPdfInfo(pdfBytes: Uint8Array): Promise<{ pageCount: number; pages: PageDimensions[] }> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageCount = pdfDoc.getPageCount();
  const pages: PageDimensions[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    pages.push({
      pageNumber: i + 1,
      width,
      height,
    });
  }

  return { pageCount, pages };
}

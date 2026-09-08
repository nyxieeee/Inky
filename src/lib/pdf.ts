// Inky PDF Utilities & Client-Side Flattening
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { SignatureField } from '../types';

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

/**
 * Flattens signatures, initials, and date fields into PDF bytes directly in the browser
 */
export async function flattenPdfSignatures(
  pdfBytes: Uint8Array,
  fields: SignatureField[],
  options?: { signerName?: string; signerEmail?: string }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);
  const pageCount = pdfDoc.getPageCount();

  for (const field of fields) {
    if (!field.value) continue;
    const pageIndex = field.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pageCount) continue;

    const page = pdfDoc.getPage(pageIndex);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const x = (field.x / 100) * pageWidth;
    const w = (field.width / 100) * pageWidth;
    const h = (field.height / 100) * pageHeight;
    // In PDF coordinate system, (0,0) is bottom-left, whereas canvas (0,0) is top-left
    const y = pageHeight - ((field.y / 100) * pageHeight) - h;

    if (field.fieldType === 'signature' || field.fieldType === 'initials') {
      try {
        // field.value is data:image/png;base64,...
        const base64Data = field.value.split(',')[1] || field.value;
        const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const img = await pdfDoc.embedPng(imgBytes);

        // Preserve aspect ratio (contain within bounding box)
        const imgAspect = img.width / img.height;
        const boxAspect = w / h;

        let drawW = w;
        let drawH = h;
        if (imgAspect > boxAspect) {
          drawW = w;
          drawH = w / imgAspect;
        } else {
          drawH = h;
          drawW = h * imgAspect;
        }

        // Center within field bounding box
        const drawX = x + (w - drawW) / 2;
        const drawY = y + (h - drawH) / 2;

        page.drawImage(img, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });
      } catch (err) {
        console.error('Failed to embed signature image:', err);
      }
    } else {
      // Text or date field
      const fontSize = Math.max(10, Math.min(18, h * 0.7));
      let selectedPdfFont = helvetica;
      const ff = (field.fontFamily || '').toLowerCase();
      if (ff.includes('times') || ff.includes('garamond') || ff.includes('serif')) {
        selectedPdfFont = timesRoman;
      } else if (ff.includes('courier') || ff.includes('mono')) {
        selectedPdfFont = courier;
      } else {
        selectedPdfFont = helvetica;
      }

      page.drawText(field.value, {
        x: x + 4,
        y: y + (h - fontSize) / 2,
        size: fontSize,
        font: selectedPdfFont,
        color: rgb(0.15, 0.15, 0.15),
      });
    }
  }

  // Metadata & lightweight audit stamp
  pdfDoc.setProducer('Inky E-Signature App (Local Edition)');
  pdfDoc.setModificationDate(new Date());

  return await pdfDoc.save();
}

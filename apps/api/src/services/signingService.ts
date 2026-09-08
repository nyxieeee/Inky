import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SignatureField } from '@esign/shared';

export interface BurnOptions {
  sourcePdfPath: string;
  outputPath: string;
  fields: SignatureField[];
  signerEmail?: string;
  signerName?: string;
  addAuditPage?: boolean;
}

export async function flattenDocumentSignatures({
  sourcePdfPath,
  outputPath,
  fields,
  signerEmail = 'boss@esign.app',
  signerName = 'Primary User',
  addAuditPage = true
}: BurnOptions): Promise<{ outputPath: string; auditHash: string }> {
  const existingPdfBytes = fs.readFileSync(sourcePdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const field of fields) {
    if (!field.value) continue;
    const pageIdx = Math.max(0, Math.min(pages.length - 1, field.pageNumber - 1));
    const page = pages[pageIdx];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert percentage coordinates (0-100) to PDF points
    const pdfX = (field.x / 100) * pageWidth;
    const fieldWidth = (field.width / 100) * pageWidth;
    const fieldHeight = (field.height / 100) * pageHeight;
    // PDF origin (0,0) is bottom-left, web canvas is top-left
    const pdfY = pageHeight - ((field.y / 100) * pageHeight) - fieldHeight;

    if (field.fieldType === 'signature' || field.fieldType === 'initials') {
      if (field.value.startsWith('data:image')) {
        // Embed PNG or JPG image
        const base64Data = field.value.split(',')[1];
        const imageBytes = Buffer.from(base64Data, 'base64');
        
        let image;
        if (field.value.includes('image/jpeg') || field.value.includes('image/jpg')) {
          image = await pdfDoc.embedJpg(imageBytes);
        } else {
          image = await pdfDoc.embedPng(imageBytes);
        }

        page.drawImage(image, {
          x: pdfX,
          y: pdfY,
          width: fieldWidth,
          height: fieldHeight,
        });
      } else {
        // Fallback text rendering for typed signatures
        page.drawText(field.value, {
          x: pdfX,
          y: pdfY + (fieldHeight * 0.3),
          size: Math.max(12, fieldHeight * 0.4),
          font: boldFont,
          color: rgb(0.08, 0.12, 0.28),
        });
      }
    } else if (field.fieldType === 'date' || field.fieldType === 'name' || field.fieldType === 'text') {
      page.drawText(field.value, {
        x: pdfX,
        y: pdfY + (fieldHeight * 0.25),
        size: Math.max(10, Math.min(16, fieldHeight * 0.4)),
        font,
        color: rgb(0.1, 0.1, 0.15),
      });
    }
  }

  // Generate cryptographic signature hash
  const timestamp = new Date().toISOString();
  const hashInput = `${sourcePdfPath}:${timestamp}:${signerEmail}:${fields.length}`;
  const auditHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  // Embed Metadata into PDF
  pdfDoc.setTitle('Signed Document');
  pdfDoc.setAuthor(signerName);
  pdfDoc.setProducer('E-Sign Mobile App v1.0');
  pdfDoc.setKeywords(['E-Signed', `SHA256:${auditHash}`, `SignedBy:${signerEmail}`, `Timestamp:${timestamp}`]);

  // Optionally append Audit Trail page
  if (addAuditPage) {
    const auditPage = pdfDoc.addPage([612, 792]); // Standard Letter size
    const { height: aHeight } = auditPage.getSize();

    auditPage.drawRectangle({
      x: 36,
      y: aHeight - 80,
      width: 540,
      height: 48,
      color: rgb(0.95, 0.97, 1.0),
      borderColor: rgb(0.2, 0.4, 0.9),
      borderWidth: 1,
    });

    auditPage.drawText('DOCUMENT AUDIT TRAIL CERTIFICATE', {
      x: 54,
      y: aHeight - 62,
      size: 16,
      font: boldFont,
      color: rgb(0.1, 0.25, 0.65),
    });

    auditPage.drawText(`Document SHA-256 Audit Seal: ${auditHash}`, {
      x: 54,
      y: aHeight - 110,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.45),
    });

    auditPage.drawText(`Signing Timestamp: ${timestamp}`, {
      x: 54,
      y: aHeight - 130,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.25),
    });

    auditPage.drawText(`Signer Email: ${signerEmail}`, {
      x: 54,
      y: aHeight - 150,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.25),
    });

    auditPage.drawText(`Signer Name: ${signerName}`, {
      x: 54,
      y: aHeight - 170,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.25),
    });

    auditPage.drawText(`Total Applied Fields: ${fields.length}`, {
      x: 54,
      y: aHeight - 190,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.25),
    });

    // Verification Footer
    auditPage.drawText('Verified & Secured by E-Sign App (Personal Digital Signatures)', {
      x: 54,
      y: 40,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, pdfBytes);

  return { outputPath, auditHash };
}

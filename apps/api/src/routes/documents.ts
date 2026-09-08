import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument } from 'pdf-lib';
import { db } from '../db.js';
import { flattenDocumentSignatures } from '../services/signingService.js';
import { Document, SignatureField } from '@esign/shared';

const router = Router();

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported currently.'));
    }
  },
});

// GET /api/documents — List documents
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, source, search } = req.query;
    let query = 'SELECT * FROM documents WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }
    if (search) {
      query += ' AND (title LIKE ? OR original_file_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const rows = await db.prepare(query).all(...params);

    const documents: Document[] = rows.map((row) => ({
      id: row.id,
      ownerId: row.owner_id,
      title: row.title,
      status: row.status,
      source: row.source,
      filePath: row.file_path,
      originalFileName: row.original_file_name,
      fileSizeBytes: row.file_size_bytes,
      pageCount: row.page_count,
      inboxLinkId: row.inbox_link_id,
      auditHash: row.audit_hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json(documents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/upload — Upload document
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }

    const { title, ownerId = 'boss' } = req.body;
    const filePath = req.file.path;
    const fileBytes = fs.readFileSync(filePath);

    let pageCount = 1;
    try {
      const pdfDoc = await PDFDocument.load(fileBytes);
      pageCount = pdfDoc.getPageCount();
    } catch (e) {
      console.warn('Could not parse PDF page count:', e);
    }

    const docId = uuidv4();
    const docTitle = title || req.file.originalname.replace(/\.pdf$/i, '');
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO documents (id, owner_id, title, status, source, file_path, original_file_name, file_size_bytes, page_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(docId, ownerId, docTitle, 'draft', 'uploaded', filePath, req.file.originalname, req.file.size, pageCount, now, now);

    const newDoc: Document = {
      id: docId,
      ownerId,
      title: docTitle,
      status: 'draft',
      source: 'uploaded',
      filePath,
      originalFileName: req.file.originalname,
      fileSizeBytes: req.file.size,
      pageCount,
      createdAt: now,
      updatedAt: now,
    };

    res.status(201).json(newDoc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/:id — Get document details + fields + recipients
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const fieldsRows = await db.prepare('SELECT * FROM signature_fields WHERE document_id = ?').all(req.params.id);
    const recipientRows = await db.prepare('SELECT * FROM recipients WHERE document_id = ? ORDER BY signing_order ASC').all(req.params.id);

    const fields: SignatureField[] = fieldsRows.map((f) => ({
      id: f.id,
      documentId: f.document_id,
      pageNumber: f.page_number,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      fieldType: f.field_type,
      value: f.value,
      signerId: f.signer_id,
      signerEmail: f.signer_email,
      required: Boolean(f.required),
    }));

    const recipients = recipientRows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      email: r.email,
      name: r.name,
      signingOrder: r.signing_order,
      status: r.status,
      signedAt: r.signed_at,
      token: r.token,
    }));

    res.json({
      id: doc.id,
      ownerId: doc.owner_id,
      title: doc.title,
      status: doc.status,
      source: doc.source,
      filePath: doc.file_path,
      originalFileName: doc.original_file_name,
      fileSizeBytes: doc.file_size_bytes,
      pageCount: doc.page_count,
      inboxLinkId: doc.inbox_link_id,
      auditHash: doc.audit_hash,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
      fields,
      recipients,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/:id/file — Serve PDF file
router.get('/:id/file', async (req: Request, res: Response) => {
  try {
    const doc = await db.prepare('SELECT file_path, original_file_name FROM documents WHERE id = ?').get(req.params.id);
    if (!doc || !fs.existsSync(doc.file_path)) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_file_name)}"`);
    fs.createReadStream(doc.file_path).pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/:id/fields — Save / sync signature fields
router.post('/:id/fields', async (req: Request, res: Response) => {
  try {
    const { fields } = req.body as { fields: SignatureField[] };
    const docId = req.params.id;

    const doc = await db.prepare('SELECT id FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await db.prepare('DELETE FROM signature_fields WHERE document_id = ?').run(docId);

    for (const f of fields) {
      await db.prepare(`
        INSERT INTO signature_fields (id, document_id, page_number, x, y, width, height, field_type, value, signer_id, signer_email, required)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        f.id || uuidv4(),
        docId,
        f.pageNumber,
        f.x,
        f.y,
        f.width,
        f.height,
        f.fieldType,
        f.value || null,
        f.signerId || null,
        f.signerEmail || null,
        f.required ? 1 : 0
      );
    }

    await db.prepare('UPDATE documents SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), docId);
    res.json({ message: 'Fields saved successfully', count: fields.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/:id/sign — Burn signatures into PDF & finalize
router.post('/:id/sign', async (req: Request, res: Response) => {
  try {
    const docId = req.params.id;
    const { signerEmail = 'boss@esign.app', signerName = 'Primary User', addAuditPage = true } = req.body;

    const doc = await db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const fieldsRows = await db.prepare('SELECT * FROM signature_fields WHERE document_id = ?').all(docId);
    const fields: SignatureField[] = fieldsRows.map((f) => ({
      id: f.id,
      documentId: f.document_id,
      pageNumber: f.page_number,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      fieldType: f.field_type,
      value: f.value,
      signerId: f.signer_id,
      signerEmail: f.signer_email,
      required: Boolean(f.required),
    }));

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields placed on document to sign.' });
    }

    const signedFileName = `signed_${Date.now()}_${doc.original_file_name}`;
    const outputPath = path.join(uploadDir, signedFileName);

    const { auditHash } = await flattenDocumentSignatures({
      sourcePdfPath: doc.file_path,
      outputPath,
      fields,
      signerEmail,
      signerName,
      addAuditPage,
    });

    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE documents
      SET status = 'completed', file_path = ?, audit_hash = ?, updated_at = ?
      WHERE id = ?
    `).run(outputPath, auditHash, now, docId);

    await db.prepare(`
      INSERT INTO audit_logs (id, document_id, action, performer_email, performer_ip, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      docId,
      'DOCUMENT_SIGNED_FLATTENED',
      signerEmail,
      req.ip || '127.0.0.1',
      now,
      `Audit Hash: ${auditHash}, Applied Fields: ${fields.length}`
    );

    res.json({
      message: 'Document signed and flattened successfully',
      documentId: docId,
      status: 'completed',
      auditHash,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await db.prepare('SELECT file_path FROM documents WHERE id = ?').get(req.params.id);
    if (doc && fs.existsSync(doc.file_path)) {
      try { fs.unlinkSync(doc.file_path); } catch (e) {}
    }
    await db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    res.json({ message: 'Document deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

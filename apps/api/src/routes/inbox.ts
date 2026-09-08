import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument } from 'pdf-lib';
import { db } from '../db.js';
import { InboxLink } from '@esign/shared';

const router = Router();

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 25 * 1024 * 1024 },
});

// POST /api/inbox/links — Create shareable upload link
router.post('/links', async (req: Request, res: Response) => {
  try {
    const { title = 'Upload Document for Signing', note, expiresHours = 168, maxUses = 10, ownerId = 'boss' } = req.body;
    const linkId = uuidv4();
    const token = uuidv4().replace(/-/g, '').substring(0, 16);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresHours * 3600 * 1000).toISOString();

    await db.prepare(`
      INSERT INTO inbox_links (id, owner_id, token, title, note, expires_at, max_uses, current_uses, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
    `).run(linkId, ownerId, token, title, note || null, expiresAt, maxUses, now.toISOString());

    const newLink: InboxLink = {
      id: linkId,
      ownerId,
      token,
      title,
      note,
      expiresAt,
      maxUses,
      currentUses: 0,
      active: true,
      createdAt: now.toISOString(),
    };

    res.status(201).json(newLink);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inbox/links — List all inbox links
router.get('/links', async (req: Request, res: Response) => {
  try {
    const rows = await db.prepare('SELECT * FROM inbox_links ORDER BY created_at DESC').all();
    const links: InboxLink[] = rows.map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      token: r.token,
      title: r.title,
      note: r.note,
      expiresAt: r.expires_at,
      maxUses: r.max_uses,
      currentUses: r.current_uses,
      active: Boolean(r.active),
      createdAt: r.created_at,
    }));
    res.json(links);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inbox/validate/:token — Check token validity
router.get('/validate/:token', async (req: Request, res: Response) => {
  try {
    const link = await db.prepare('SELECT * FROM inbox_links WHERE token = ?').get(req.params.token);
    if (!link) {
      return res.status(404).json({ valid: false, error: 'Link not found' });
    }
    if (!link.active) {
      return res.status(410).json({ valid: false, error: 'Link has been deactivated' });
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ valid: false, error: 'Link has expired' });
    }
    if (link.max_uses && link.current_uses >= link.max_uses) {
      return res.status(410).json({ valid: false, error: 'Link usage limit reached' });
    }

    res.json({
      valid: true,
      title: link.title,
      note: link.note,
      token: link.token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inbox/upload/:token — External sender uploads document
router.post('/upload/:token', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { senderName = 'External Sender', senderEmail = 'sender@example.com', title } = req.body;

    const link = await db.prepare('SELECT * FROM inbox_links WHERE token = ?').get(token);
    if (!link || !link.active) {
      return res.status(404).json({ error: 'Invalid or inactive upload link token' });
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Upload link has expired' });
    }
    if (link.max_uses && link.current_uses >= link.max_uses) {
      return res.status(410).json({ error: 'Upload limit reached for this link' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    let pageCount = 1;
    try {
      const pdfDoc = await PDFDocument.load(fs.readFileSync(req.file.path));
      pageCount = pdfDoc.getPageCount();
    } catch (e) {}

    const docId = uuidv4();
    const docTitle = title || `Inbound: ${req.file.originalname.replace(/\.pdf$/i, '')}`;
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO documents (id, owner_id, title, status, source, file_path, original_file_name, file_size_bytes, page_count, inbox_link_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(docId, link.owner_id, docTitle, 'pending', 'inbound', req.file.path, req.file.originalname, req.file.size, pageCount, link.id, now, now);

    await db.prepare('UPDATE inbox_links SET current_uses = current_uses + 1 WHERE id = ?').run(link.id);

    await db.prepare(`
      INSERT INTO audit_logs (id, document_id, action, performer_email, performer_ip, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), docId, 'INBOUND_DOCUMENT_SUBMITTED', senderEmail, req.ip || '127.0.0.1', now, `Sender: ${senderName} (${senderEmail}) via Inbox Token: ${token}`);

    res.status(201).json({
      message: 'Document successfully submitted to signature queue',
      documentId: docId,
      title: docTitle,
      status: 'pending',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/inbox/links/:id
router.delete('/links/:id', async (req: Request, res: Response) => {
  try {
    await db.prepare('UPDATE inbox_links SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Inbox link deactivated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

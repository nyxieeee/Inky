import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';

const router = Router();

// POST /api/documents/:id/recipients — Set / update recipients for document
router.post('/documents/:id/recipients', async (req: Request, res: Response) => {
  try {
    const docId = req.params.id;
    const { recipients } = req.body as { recipients: { email: string; name: string; signingOrder?: number }[] };

    const doc = await db.prepare('SELECT id FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await db.prepare('DELETE FROM recipients WHERE document_id = ?').run(docId);

    for (let idx = 0; idx < recipients.length; idx++) {
      const r = recipients[idx];
      const token = uuidv4().replace(/-/g, '');
      await db.prepare(`
        INSERT INTO recipients (id, document_id, email, name, signing_order, status, token)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), docId, r.email, r.name, r.signingOrder || idx + 1, 'pending', token);
    }

    const updatedRecipients = await db.prepare('SELECT * FROM recipients WHERE document_id = ? ORDER BY signing_order ASC').all(docId);
    res.json(updatedRecipients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/:id/send — Send document out to recipients
router.post('/documents/:id/send', async (req: Request, res: Response) => {
  try {
    const docId = req.params.id;
    const doc = await db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const recipients = await db.prepare('SELECT * FROM recipients WHERE document_id = ? ORDER BY signing_order ASC').all(docId);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'Please add at least one recipient before sending.' });
    }

    const now = new Date().toISOString();

    await db.prepare("UPDATE documents SET status = 'pending', updated_at = ? WHERE id = ?").run(now, docId);

    await db.prepare(`
      INSERT INTO audit_logs (id, document_id, action, performer_email, performer_ip, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), docId, 'DOCUMENT_SENT_OUT', 'boss@esign.app', req.ip || '127.0.0.1', now, `Sent to ${recipients.length} recipients`);

    res.json({
      message: `Document sent out to ${recipients.length} signers`,
      documentId: docId,
      status: 'pending',
      recipients: recipients.map((r) => ({
        email: r.email,
        name: r.name,
        signingOrder: r.signing_order,
        signingLink: `/signing-portal/${r.token}`,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/signing-portal/:token — Recipient signing view token validation
router.get('/signing-portal/:token', async (req: Request, res: Response) => {
  try {
    const recipient = await db.prepare('SELECT * FROM recipients WHERE token = ?').get(req.params.token);
    if (!recipient) {
      return res.status(404).json({ error: 'Invalid signing token' });
    }

    const doc = await db.prepare('SELECT * FROM documents WHERE id = ?').get(recipient.document_id);
    if (!doc) {
      return res.status(404).json({ error: 'Associated document not found' });
    }

    const fieldsRows = await db.prepare('SELECT * FROM signature_fields WHERE document_id = ? AND (signer_email = ? OR signer_email IS NULL)').all(doc.id, recipient.email);

    res.json({
      recipient: {
        id: recipient.id,
        email: recipient.email,
        name: recipient.name,
        signingOrder: recipient.signing_order,
        status: recipient.status,
      },
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        pageCount: doc.page_count,
        originalFileName: doc.original_file_name,
      },
      fields: fieldsRows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/signing-portal/:token/submit — Recipient signs assigned fields
router.post('/signing-portal/:token/submit', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { fields } = req.body as { fields: { id: string; value: string }[] };

    const recipient = await db.prepare('SELECT * FROM recipients WHERE token = ?').get(token);
    if (!recipient) {
      return res.status(404).json({ error: 'Invalid signing token' });
    }

    const now = new Date().toISOString();

    for (const f of fields) {
      await db.prepare('UPDATE signature_fields SET value = ? WHERE id = ?').run(f.value, f.id);
    }

    await db.prepare("UPDATE recipients SET status = 'signed', signed_at = ? WHERE id = ?").run(now, recipient.id);

    const pendingRecipients = await db.prepare("SELECT COUNT(*) as cnt FROM recipients WHERE document_id = ? AND status != 'signed'").get(recipient.document_id);

    if (pendingRecipients && pendingRecipients.cnt === 0) {
      await db.prepare("UPDATE documents SET status = 'partially_signed', updated_at = ? WHERE id = ?").run(now, recipient.document_id);
    }

    await db.prepare(`
      INSERT INTO audit_logs (id, document_id, action, performer_email, performer_ip, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), recipient.document_id, 'RECIPIENT_SIGNED', recipient.email, req.ip || '127.0.0.1', now, `Recipient ${recipient.name} signed ${fields.length} fields`);

    res.json({
      message: 'Signatures submitted successfully',
      recipientStatus: 'signed',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

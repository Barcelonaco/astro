import { Form } from '../models/Form.js';
import db from '../db.js';
import { Resend } from 'resend';

// ── Admin: Forms CRUD ──

export const getAllForms = async (req, res) => {
  try {
    const forms = await Form.findAll();
    res.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
};

export const getFormById = async (req, res) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    form.settings = typeof form.settings === 'string' ? JSON.parse(form.settings) : form.settings;
    form.fields = await Form.getFields(form.id);
    res.json(form);
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
};

export const createForm = async (req, res) => {
  try {
    const { title, slug, description, settings, status, fields } = req.body;
    if (!title || !slug) return res.status(400).json({ error: 'Title and slug are required' });

    const existing = await Form.findBySlug(slug);
    if (existing) return res.status(400).json({ error: 'A form with this slug already exists' });

    const id = await Form.create({ title, slug, description, settings, status });

    if (fields && fields.length > 0) {
      await Form.saveFields(id, fields);
    }

    const form = await Form.findById(id);
    form.fields = await Form.getFields(id);
    res.status(201).json(form);
  } catch (error) {
    console.error('Error creating form:', error);
    res.status(500).json({ error: 'Failed to create form' });
  }
};

export const updateForm = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await Form.findById(id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const { title, slug, description, settings, status, fields } = req.body;
    if (!title || !slug) return res.status(400).json({ error: 'Title and slug are required' });

    const existingSlug = await Form.findBySlug(slug);
    if (existingSlug && existingSlug.id !== parseInt(id)) {
      return res.status(400).json({ error: 'A form with this slug already exists' });
    }

    await Form.update(id, { title, slug, description, settings, status });

    if (fields !== undefined) {
      await Form.saveFields(id, fields);
    }

    const updated = await Form.findById(id);
    updated.fields = await Form.getFields(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating form:', error);
    res.status(500).json({ error: 'Failed to update form' });
  }
};

export const deleteForm = async (req, res) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    await Form.delete(req.params.id);
    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({ error: 'Failed to delete form' });
  }
};

// ── Admin: Entries ──

export const getFormEntries = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await Form.findById(id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const { status, page, per_page } = req.query;
    const result = await Form.getEntries(id, {
      status,
      page: parseInt(page) || 1,
      perPage: parseInt(per_page) || 20,
    });

    const counts = await Form.getEntryCounts(id);
    res.json({ ...result, counts });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
};

export const getEntryById = async (req, res) => {
  try {
    const entry = await Form.getEntryById(req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    // Mark as read automatically
    if (entry.status === 'unread') {
      await Form.updateEntryStatus(entry.id, 'read');
      entry.status = 'read';
    }

    res.json(entry);
  } catch (error) {
    console.error('Error fetching entry:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
};

export const updateEntryStatus = async (req, res) => {
  try {
    const { entryId } = req.params;
    const { status } = req.body;

    if (!['unread', 'read', 'starred', 'trash'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const entry = await Form.getEntryById(entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    await Form.updateEntryStatus(entryId, status);
    res.json({ message: 'Entry status updated' });
  } catch (error) {
    console.error('Error updating entry status:', error);
    res.status(500).json({ error: 'Failed to update entry status' });
  }
};

export const deleteEntry = async (req, res) => {
  try {
    const entry = await Form.getEntryById(req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    await Form.deleteEntry(req.params.entryId);
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting entry:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
};

export const exportEntries = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await Form.findById(id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const fields = await Form.getFields(id);
    const result = await Form.getEntries(id, { page: 1, perPage: 100000 });

    // Build CSV
    const headers = ['ID', 'Date', ...fields.map(f => f.label), 'IP', 'Status'];
    const rows = result.entries.map(entry => {
      const vals = fields.map(f => {
        const v = entry.values.find(ev => ev.field_id === f.id);
        return v ? `"${(v.field_value || '').replace(/"/g, '""')}"` : '""';
      });
      return [
        entry.id,
        `"${new Date(entry.created_at).toLocaleString('fr-FR')}"`,
        ...vals,
        `"${entry.ip_address || ''}"`,
        entry.status,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="form-${id}-entries.csv"`);
    res.send('\ufeff' + csv); // BOM for Excel
  } catch (error) {
    console.error('Error exporting entries:', error);
    res.status(500).json({ error: 'Failed to export entries' });
  }
};

// ── Public: Form rendering & submission ──

export const getPublicForm = async (req, res) => {
  try {
    const form = await Form.getPublicForm(req.params.id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    // Include reCAPTCHA site key if enabled
    if (form.settings?.recaptcha_enabled) {
      const [rows] = await db.query(
        "SELECT setting_value FROM settings WHERE setting_key = 'recaptcha_site_key'"
      );
      form.recaptcha_site_key = rows[0]?.setting_value || null;
    }

    res.json(form);
  } catch (error) {
    console.error('Error fetching public form:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
};

export const submitForm = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await Form.findById(id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const formSettings = typeof form.settings === 'string' ? JSON.parse(form.settings) : (form.settings || {});

    // Verify reCAPTCHA if enabled
    if (formSettings.recaptcha_enabled) {
      const recaptchaToken = req.body._recaptcha_token;

      if (recaptchaToken) {
        const [rows] = await db.query(
          "SELECT setting_value FROM settings WHERE setting_key = 'recaptcha_secret_key'"
        );
        const secretKey = rows[0]?.setting_value;

        if (secretKey) {
          try {
            const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(recaptchaToken)}`;
            const verifyRes = await fetch(verifyUrl, { method: 'POST' });
            const verifyData = await verifyRes.json();

            if (!verifyData.success || (verifyData.score !== undefined && verifyData.score < 0.3)) {
              console.warn(`[reCAPTCHA] Rejected: ${JSON.stringify(verifyData)}`);
              return res.status(400).json({ error: 'Vérification anti-spam échouée. Réessayez.' });
            }
            console.log(`[reCAPTCHA] OK — score: ${verifyData.score ?? 'n/a'}`);
          } catch (err) {
            console.warn('[reCAPTCHA] Verification request failed:', err.message);
          }
        }
      } else {
        console.warn(`[Form #${id}] No reCAPTCHA token received, allowing submission`);
      }
    }

    // Get form fields for validation
    const fields = await Form.getFields(id);
    const submissionData = req.body;
    const fieldValues = [];

    for (const field of fields) {
      if (field.type === 'html') continue; // Skip static HTML fields

      const value = submissionData[field.name];

      // Required field validation
      if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
        return res.status(400).json({
          error: `Le champ "${field.label}" est requis`,
          field: field.name,
        });
      }

      // Email validation
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return res.status(400).json({
          error: `L'adresse email n'est pas valide`,
          field: field.name,
        });
      }

      // Phone validation
      if (field.type === 'phone' && value && !/^[\d\s\-+().]{6,20}$/.test(value)) {
        return res.status(400).json({
          error: `Le numéro de téléphone n'est pas valide`,
          field: field.name,
        });
      }

      let fieldValue = value;
      if (Array.isArray(value)) {
        fieldValue = value.join(', ');
      } else if (typeof value === 'object' && value !== null) {
        fieldValue = JSON.stringify(value);
      }

      fieldValues.push({
        field_id: field.id,
        field_label: field.label,
        field_value: fieldValue || '',
      });
    }

    // Create the entry
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.socket?.remoteAddress
      || null;
    const ip = rawIp === '::1' ? '127.0.0.1' : (rawIp?.replace(/^::ffff:/, '') || null);
    const ua = req.headers['user-agent'] || null;

    const entryId = await Form.createEntry(id, {
      ip_address: ip,
      user_agent: ua,
      fieldValues,
    });

    // Send notification email if configured
    if (formSettings.notification_enabled && formSettings.notification_email && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
        const subject = formSettings.notification_subject || `Nouveau message — ${form.title}`;
        const recipients = formSettings.notification_email.split(',').map(e => e.trim()).filter(Boolean);

        const fieldsHtml = fieldValues.map(fv =>
          `<tr><td style="padding:8px 12px;font-weight:600;vertical-align:top;border-bottom:1px solid #eee;color:#555">${fv.field_label}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${(fv.field_value || '—').replace(/\n/g, '<br>')}</td></tr>`
        ).join('');

        const html = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#333;border-bottom:2px solid #667eea;padding-bottom:8px">${subject}</h2>
            <table style="width:100%;border-collapse:collapse;margin-top:16px">${fieldsHtml}</table>
            <p style="margin-top:24px;font-size:13px;color:#999">
              Entrée #${entryId} — ${new Date().toLocaleString('fr-FR')}<br>
              IP: ${ip || 'N/A'}
            </p>
          </div>
        `;

        await resend.emails.send({
          from: fromEmail,
          to: recipients,
          subject,
          html,
        });
        console.log(`[Form #${id}] Notification sent to: ${recipients.join(', ')}`);
      } catch (emailErr) {
        console.error(`[Form #${id}] Failed to send notification:`, emailErr.message);
      }
    }

    const confirmationMessage = formSettings.confirmation_message || 'Votre message a bien été envoyé.';
    res.status(201).json({
      message: confirmationMessage,
      entry_id: entryId,
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({ error: 'Failed to submit form' });
  }
};

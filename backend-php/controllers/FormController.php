<?php

class FormController {
    public static function getAll(): void {
        json_response(FormModel::findAll());
    }

    public static function getById(int $id): void {
        $form = FormModel::findById($id);
        if (!$form) error_response('Form not found', 404);
        $form['settings'] = is_string($form['settings']) ? json_decode($form['settings'], true) : $form['settings'];
        $form['fields'] = FormModel::getFields($id);
        json_response($form);
    }

    public static function create(): void {
        $body = get_json_body();
        if (empty($body['title']) || empty($body['slug'])) error_response('Title and slug are required', 400);

        $existing = FormModel::findBySlug($body['slug']);
        if ($existing) error_response('A form with this slug already exists', 400);

        $id = FormModel::create($body);
        if (!empty($body['fields'])) {
            FormModel::saveFields($id, $body['fields']);
        }

        $form = FormModel::findById($id);
        $form['fields'] = FormModel::getFields($id);
        json_response($form, 201);
    }

    public static function update(int $id): void {
        $form = FormModel::findById($id);
        if (!$form) error_response('Form not found', 404);

        $body = get_json_body();
        if (empty($body['title']) || empty($body['slug'])) error_response('Title and slug are required', 400);

        $existingSlug = FormModel::findBySlug($body['slug']);
        if ($existingSlug && (int) $existingSlug['id'] !== $id) {
            error_response('A form with this slug already exists', 400);
        }

        FormModel::update($id, $body);
        if (isset($body['fields'])) {
            FormModel::saveFields($id, $body['fields']);
        }

        $updated = FormModel::findById($id);
        $updated['fields'] = FormModel::getFields($id);
        json_response($updated);
    }

    public static function delete(int $id): void {
        $form = FormModel::findById($id);
        if (!$form) error_response('Form not found', 404);
        FormModel::delete($id);
        json_response(['message' => 'Form deleted successfully']);
    }

    public static function getEntries(int $id): void {
        $form = FormModel::findById($id);
        if (!$form) error_response('Form not found', 404);

        $result = FormModel::getEntries($id, [
            'status' => $_GET['status'] ?? null,
            'page' => (int) ($_GET['page'] ?? 1),
            'perPage' => (int) ($_GET['per_page'] ?? 20),
        ]);

        $counts = FormModel::getEntryCounts($id);
        json_response(array_merge($result, ['counts' => $counts]));
    }

    public static function getEntryById(int $entryId): void {
        $entry = FormModel::getEntryById($entryId);
        if (!$entry) error_response('Entry not found', 404);

        if ($entry['status'] === 'unread') {
            FormModel::updateEntryStatus($entryId, 'read');
            $entry['status'] = 'read';
        }
        json_response($entry);
    }

    public static function updateEntryStatus(int $entryId): void {
        $body = get_json_body();
        $status = $body['status'] ?? '';
        if (!in_array($status, ['unread', 'read', 'starred', 'trash'])) {
            error_response('Invalid status', 400);
        }
        $entry = FormModel::getEntryById($entryId);
        if (!$entry) error_response('Entry not found', 404);
        FormModel::updateEntryStatus($entryId, $status);
        json_response(['message' => 'Entry status updated']);
    }

    public static function deleteEntry(int $entryId): void {
        $entry = FormModel::getEntryById($entryId);
        if (!$entry) error_response('Entry not found', 404);
        FormModel::deleteEntry($entryId);
        json_response(['message' => 'Entry deleted successfully']);
    }

    public static function exportEntries(int $id): void {
        $form = FormModel::findById($id);
        if (!$form) error_response('Form not found', 404);

        $fields = FormModel::getFields($id);
        $result = FormModel::getEntries($id, ['page' => 1, 'perPage' => 100000]);

        $headers = array_merge(['ID', 'Date'], array_column($fields, 'label'), ['IP', 'Status']);
        $rows = [];
        foreach ($result['entries'] as $entry) {
            $vals = [];
            foreach ($fields as $f) {
                $found = null;
                foreach ($entry['values'] as $ev) {
                    if ($ev['field_id'] == $f['id']) { $found = $ev; break; }
                }
                $vals[] = '"' . str_replace('"', '""', $found['field_value'] ?? '') . '"';
            }
            $rows[] = implode(',', array_merge(
                [$entry['id'], '"' . date('d/m/Y H:i', strtotime($entry['created_at'])) . '"'],
                $vals,
                ['"' . ($entry['ip_address'] ?? '') . '"', $entry['status']]
            ));
        }

        $csv = implode("\n", array_merge([implode(',', $headers)], $rows));

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="form-' . $id . '-entries.csv"');
        echo "\xEF\xBB\xBF" . $csv; // BOM for Excel
        exit;
    }

    public static function getPublicForm(int $id): void {
        $form = FormModel::getPublicForm($id);
        if (!$form) error_response('Form not found', 404);

        if (!empty($form['settings']['recaptcha_enabled'])) {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'recaptcha_site_key'");
            $stmt->execute();
            $row = $stmt->fetch();
            $form['recaptcha_site_key'] = $row['setting_value'] ?? null;
        }

        json_response($form);
    }

    public static function submitForm(int $id): void {
        $form = FormModel::findById($id);
        if (!$form) error_response('Form not found', 404);

        $formSettings = is_string($form['settings']) ? json_decode($form['settings'], true) : ($form['settings'] ?? []);
        $body = get_json_body();

        // reCAPTCHA verification
        if (!empty($formSettings['recaptcha_enabled']) && !empty($body['_recaptcha_token'])) {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'recaptcha_secret_key'");
            $stmt->execute();
            $row = $stmt->fetch();
            $secretKey = $row['setting_value'] ?? null;

            if ($secretKey) {
                $verifyUrl = 'https://www.google.com/recaptcha/api/siteverify?secret=' . urlencode($secretKey) . '&response=' . urlencode($body['_recaptcha_token']);
                $verifyRes = @file_get_contents($verifyUrl);
                if ($verifyRes) {
                    $verifyData = json_decode($verifyRes, true);
                    if (empty($verifyData['success']) || (isset($verifyData['score']) && $verifyData['score'] < 0.3)) {
                        error_response('Vérification anti-spam échouée. Réessayez.', 400);
                    }
                }
            }
        }

        // Validate and collect field values
        $fields = FormModel::getFields($id);
        $fieldValues = [];

        foreach ($fields as $field) {
            if ($field['type'] === 'html') continue;

            $value = $body[$field['name']] ?? null;

            if ($field['required'] && (empty($value) || (is_string($value) && !trim($value)))) {
                error_response("Le champ \"{$field['label']}\" est requis", 400);
            }

            if ($field['type'] === 'email' && $value && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                error_response("L'adresse email n'est pas valide", 400);
            }

            if ($field['type'] === 'phone' && $value && !preg_match('/^[\d\s\-+().]{6,20}$/', $value)) {
                error_response("Le numéro de téléphone n'est pas valide", 400);
            }

            $fieldValue = $value;
            if (is_array($value)) $fieldValue = implode(', ', $value);
            elseif (is_object($value)) $fieldValue = json_encode($value);

            $fieldValues[] = [
                'field_id' => $field['id'],
                'field_label' => $field['label'],
                'field_value' => (string) ($fieldValue ?? ''),
            ];
        }

        // Create entry
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
        if ($ip) $ip = explode(',', $ip)[0];
        if ($ip === '::1') $ip = '127.0.0.1';
        if ($ip) $ip = preg_replace('/^::ffff:/', '', $ip);

        $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;

        $entryId = FormModel::createEntry($id, [
            'ip_address' => $ip,
            'user_agent' => $ua,
            'fieldValues' => $fieldValues,
        ]);

        // Send notification email via Resend API
        if (!empty($formSettings['notification_enabled']) && !empty($formSettings['notification_email']) && !empty($_ENV['RESEND_API_KEY'])) {
            $subject = $formSettings['notification_subject'] ?? "Nouveau message — {$form['title']}";
            $recipients = array_filter(array_map('trim', explode(',', $formSettings['notification_email'])));

            $fieldsHtml = '';
            foreach ($fieldValues as $fv) {
                $label = htmlspecialchars($fv['field_label']);
                $val = nl2br(htmlspecialchars($fv['field_value'] ?: '—'));
                $fieldsHtml .= "<tr><td style=\"padding:8px 12px;font-weight:600;vertical-align:top;border-bottom:1px solid #eee;color:#555\">{$label}</td><td style=\"padding:8px 12px;border-bottom:1px solid #eee\">{$val}</td></tr>";
            }

            $html = "<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto\"><h2 style=\"color:#333;border-bottom:2px solid #667eea;padding-bottom:8px\">{$subject}</h2><table style=\"width:100%;border-collapse:collapse;margin-top:16px\">{$fieldsHtml}</table><p style=\"margin-top:24px;font-size:13px;color:#999\">Entrée #{$entryId} — " . date('d/m/Y H:i') . "<br>IP: " . ($ip ?: 'N/A') . "</p></div>";

            $payload = json_encode([
                'from' => $_ENV['RESEND_FROM_EMAIL'] ?? 'onboarding@resend.dev',
                'to' => $recipients,
                'subject' => $subject,
                'html' => $html,
            ]);

            $ch = curl_init('https://api.resend.com/emails');
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $payload,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $_ENV['RESEND_API_KEY'],
                ],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
            ]);
            curl_exec($ch);
            curl_close($ch);
        }

        $confirmationMessage = $formSettings['confirmation_message'] ?? 'Votre message a bien été envoyé.';
        json_response(['message' => $confirmationMessage, 'entry_id' => $entryId], 201);
    }
}

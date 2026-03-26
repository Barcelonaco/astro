<?php

class FormModel {
    public static function findAll(): array {
        $db = Database::getInstance();
        return $db->query("
            SELECT f.*,
                (SELECT COUNT(*) FROM form_fields WHERE form_id = f.id) AS field_count,
                (SELECT COUNT(*) FROM form_entries WHERE form_id = f.id AND status != 'trash') AS entry_count,
                (SELECT COUNT(*) FROM form_entries WHERE form_id = f.id AND status = 'unread') AS unread_count
            FROM forms f ORDER BY f.created_at DESC
        ")->fetchAll();
    }

    public static function findById(int $id): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM forms WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function findBySlug(string $slug): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM forms WHERE slug = ?');
        $stmt->execute([$slug]);
        return $stmt->fetch() ?: null;
    }

    public static function create(array $data): int {
        $db = Database::getInstance();
        $stmt = $db->prepare('INSERT INTO forms (title, slug, description, settings, status) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([
            $data['title'], $data['slug'], $data['description'] ?? null,
            json_encode($data['settings'] ?? new \stdClass()), $data['status'] ?? 'active'
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('UPDATE forms SET title = ?, slug = ?, description = ?, settings = ?, status = ? WHERE id = ?');
        $stmt->execute([
            $data['title'], $data['slug'], $data['description'] ?? null,
            json_encode($data['settings'] ?? new \stdClass()), $data['status'] ?? 'active', $id
        ]);
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM forms WHERE id = ?')->execute([$id]);
    }

    public static function getFields(int $formId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM form_fields WHERE form_id = ? ORDER BY field_order ASC');
        $stmt->execute([$formId]);
        return array_map(function ($r) {
            $r['options'] = is_string($r['options']) ? json_decode($r['options'], true) : $r['options'];
            $r['validation'] = is_string($r['validation']) ? json_decode($r['validation'], true) : $r['validation'];
            $r['settings'] = is_string($r['settings']) ? json_decode($r['settings'], true) : $r['settings'];
            return $r;
        }, $stmt->fetchAll());
    }

    public static function saveFields(int $formId, array $fields): void {
        $db = Database::getInstance();
        $db->beginTransaction();
        try {
            $db->prepare('DELETE FROM form_fields WHERE form_id = ?')->execute([$formId]);
            $stmt = $db->prepare("INSERT INTO form_fields (form_id, type, label, name, placeholder, required, options, validation, field_order, settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($fields as $i => $f) {
                $stmt->execute([
                    $formId, $f['type'], $f['label'], $f['name'],
                    $f['placeholder'] ?? null, !empty($f['required']) ? 1 : 0,
                    json_encode($f['options'] ?? null), json_encode($f['validation'] ?? null),
                    $i, json_encode($f['settings'] ?? null)
                ]);
            }
            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function getEntries(int $formId, array $opts = []): array {
        $db = Database::getInstance();
        $status = $opts['status'] ?? null;
        $page = $opts['page'] ?? 1;
        $perPage = $opts['perPage'] ?? 20;

        $where = 'WHERE e.form_id = ?';
        $params = [$formId];

        if ($status && $status !== 'all') {
            $where .= ' AND e.status = ?';
            $params[] = $status;
        } else {
            $where .= ' AND e.status != ?';
            $params[] = 'trash';
        }

        $stmt = $db->prepare("SELECT COUNT(*) as total FROM form_entries e $where");
        $stmt->execute($params);
        $total = (int) $stmt->fetch()['total'];

        $offset = ($page - 1) * $perPage;
        $stmt = $db->prepare("SELECT e.* FROM form_entries e $where ORDER BY e.created_at DESC LIMIT ? OFFSET ?");
        $stmt->execute(array_merge($params, [$perPage, $offset]));
        $rows = $stmt->fetchAll();

        if (!empty($rows)) {
            $entryIds = array_column($rows, 'id');
            $placeholders = implode(',', array_fill(0, count($entryIds), '?'));
            $stmt = $db->prepare("SELECT * FROM form_entry_values WHERE entry_id IN ($placeholders)");
            $stmt->execute($entryIds);
            $values = $stmt->fetchAll();

            $valuesMap = [];
            foreach ($values as $v) {
                $valuesMap[$v['entry_id']][] = $v;
            }
            foreach ($rows as &$row) {
                $row['values'] = $valuesMap[$row['id']] ?? [];
            }
        }

        return [
            'entries' => $rows,
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'totalPages' => (int) ceil($total / $perPage),
        ];
    }

    public static function getEntryById(int $entryId): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM form_entries WHERE id = ?');
        $stmt->execute([$entryId]);
        $entry = $stmt->fetch();
        if (!$entry) return null;

        $stmt = $db->prepare('SELECT * FROM form_entry_values WHERE entry_id = ? ORDER BY id ASC');
        $stmt->execute([$entryId]);
        $entry['values'] = $stmt->fetchAll();
        return $entry;
    }

    public static function createEntry(int $formId, array $data): int {
        $db = Database::getInstance();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('INSERT INTO form_entries (form_id, ip_address, user_agent) VALUES (?, ?, ?)');
            $stmt->execute([$formId, $data['ip_address'] ?? null, $data['user_agent'] ?? null]);
            $entryId = (int) $db->lastInsertId();

            $stmt = $db->prepare('INSERT INTO form_entry_values (entry_id, field_id, field_label, field_value) VALUES (?, ?, ?, ?)');
            foreach ($data['fieldValues'] as $fv) {
                $stmt->execute([$entryId, $fv['field_id'] ?? null, $fv['field_label'], $fv['field_value'] ?? '']);
            }

            $db->commit();
            return $entryId;
        } catch (\Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function updateEntryStatus(int $entryId, string $status): void {
        $db = Database::getInstance();
        $db->prepare('UPDATE form_entries SET status = ? WHERE id = ?')->execute([$status, $entryId]);
    }

    public static function deleteEntry(int $entryId): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM form_entries WHERE id = ?')->execute([$entryId]);
    }

    public static function getEntryCounts(int $formId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT status, COUNT(*) as count FROM form_entries WHERE form_id = ? GROUP BY status');
        $stmt->execute([$formId]);
        $counts = ['unread' => 0, 'read' => 0, 'starred' => 0, 'trash' => 0, 'total' => 0];
        foreach ($stmt->fetchAll() as $r) {
            $counts[$r['status']] = (int) $r['count'];
            $counts['total'] += (int) $r['count'];
        }
        return $counts;
    }

    public static function getPublicForm(int $id): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT id, title, description, settings FROM forms WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $form = $stmt->fetch();
        if (!$form) return null;

        $form['settings'] = is_string($form['settings']) ? json_decode($form['settings'], true) : $form['settings'];

        $fields = self::getFields($id);
        $form['fields'] = array_map(fn($f) => [
            'id' => $f['id'],
            'type' => $f['type'],
            'label' => $f['label'],
            'name' => $f['name'],
            'placeholder' => $f['placeholder'],
            'required' => (bool) $f['required'],
            'options' => $f['options'],
            'settings' => $f['settings'],
        ], $fields);

        return $form;
    }
}

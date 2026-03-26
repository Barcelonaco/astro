<?php

class ReusableBlocController {
    private static function formatBloc(array $bloc): array {
        return [
            'id' => $bloc['id'],
            'title' => $bloc['title'],
            'content' => $bloc['content'],
            'status' => $bloc['status'],
            'created_at' => $bloc['created_at'],
            'updated_at' => $bloc['updated_at'],
            'author' => ['name' => $bloc['author_name'] ?? null]
        ];
    }

    public static function getAll(): void {
        $blocs = ReusableBlocModel::findAll();
        json_response(array_map([self::class, 'formatBloc'], $blocs));
    }

    public static function getById(int $id): void {
        $bloc = ReusableBlocModel::findById($id);
        if (!$bloc) error_response('Reusable bloc not found', 404);
        json_response(self::formatBloc($bloc));
    }

    public static function create(array $authUser): void {
        $body = get_json_body();
        if (empty($body['title'])) error_response('Title is required', 400);

        $content = isset($body['content']) ? (string) $body['content'] : '[]';
        $blocId = ReusableBlocModel::create([
            'title' => $body['title'],
            'content' => $content,
            'status' => $body['status'] ?? 'published',
            'author_id' => $authUser['id']
        ]);
        json_response(['id' => $blocId, 'message' => 'Reusable bloc created successfully'], 201);
    }

    public static function update(int $id): void {
        $body = get_json_body();
        if (empty($body['title'])) error_response('Title is required', 400);

        $content = isset($body['content']) ? (string) $body['content'] : '[]';
        ReusableBlocModel::update($id, [
            'title' => $body['title'],
            'content' => $content,
            'status' => $body['status'] ?? 'published'
        ]);
        json_response(['message' => 'Reusable bloc updated successfully']);
    }

    public static function delete(int $id): void {
        ReusableBlocModel::delete($id);
        json_response(['message' => 'Reusable bloc deleted successfully']);
    }
}

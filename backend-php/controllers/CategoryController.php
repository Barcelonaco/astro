<?php

class CategoryController {
    public static function getAll(): void {
        json_response(CategoryModel::findAll());
    }

    public static function getBySlug(string $slug): void {
        $cat = CategoryModel::findBySlug($slug);
        if (!$cat) error_response('Category not found', 404);
        json_response($cat);
    }

    public static function create(): void {
        $body = get_json_body();
        CategoryModel::create($body);
        $cat = CategoryModel::findBySlug($body['slug']);
        json_response($cat, 201);
    }

    public static function update(int $id): void {
        $body = get_json_body();
        CategoryModel::update($id, $body);
        $cat = CategoryModel::findBySlug($body['slug']);
        json_response($cat);
    }

    public static function delete(int $id): void {
        CategoryModel::delete($id);
        json_response(['message' => 'Category deleted successfully']);
    }
}

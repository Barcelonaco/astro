<?php

class UserController {
    public static function getAll(): void {
        json_response(UserModel::findAll());
    }

    public static function create(): void {
        $body = get_json_body();
        $name = $body['name'] ?? '';
        $email = $body['email'] ?? '';
        $username = $body['username'] ?? '';
        $password = $body['password'] ?? '';
        $role = $body['role'] ?? 'reader';

        if (empty($name) || empty($email) || empty($password)) {
            error_response('Nom, email et mot de passe sont requis', 400);
        }
        if (!in_array($role, ['super_admin', 'admin_site', 'editor', 'reader'])) {
            error_response('Rôle invalide', 400);
        }

        try {
            $userId = UserModel::create(['name' => $name, 'email' => $email, 'username' => $username, 'password' => $password, 'role' => $role]);
            json_response(['id' => $userId, 'message' => 'Utilisateur créé avec succès'], 201);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) {
                error_response('Cet email est déjà utilisé', 400);
            }
            throw $e;
        }
    }

    public static function update(int $id): void {
        $body = get_json_body();
        $name = $body['name'] ?? '';
        $email = $body['email'] ?? '';
        $username = $body['username'] ?? '';
        $role = $body['role'] ?? '';

        if (empty($name) || empty($email) || empty($role)) {
            error_response('Nom, email et rôle sont requis', 400);
        }
        if (!in_array($role, ['super_admin', 'admin_site', 'editor', 'reader'])) {
            error_response('Rôle invalide', 400);
        }

        try {
            UserModel::update($id, [
                'name' => $name,
                'email' => $email,
                'username' => $username,
                'role' => $role,
                'password' => $body['password'] ?? null
            ]);
            json_response(['message' => 'Utilisateur mis à jour avec succès']);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) {
                error_response('Cet email est déjà utilisé', 400);
            }
            throw $e;
        }
    }

    public static function delete(int $id, array $authUser): void {
        if ($id === (int) $authUser['id']) {
            error_response('Vous ne pouvez pas supprimer votre propre compte', 400);
        }
        UserModel::delete($id);
        json_response(['message' => 'Utilisateur supprimé avec succès']);
    }
}

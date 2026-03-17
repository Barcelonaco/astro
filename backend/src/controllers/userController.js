import { User } from '../models/User.js';

export async function getAllUsers(req, res) {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function createUser(req, res) {
  try {
    const { name, email, password, role = 'editor' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nom, email et mot de passe sont requis' });
    }

    if (!['admin', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    const userId = await User.create({ name, email, password, role });
    res.status(201).json({ id: userId, message: 'Utilisateur créé avec succès' });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
}

export async function updateUser(req, res) {
  try {
    const { name, email, role, password } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Nom, email et rôle sont requis' });
    }

    if (!['admin', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    await User.update(req.params.id, { name, email, role, password });
    res.json({ message: 'Utilisateur mis à jour avec succès' });
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
}

export async function deleteUser(req, res) {
  try {
    const targetId = parseInt(req.params.id);

    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    await User.delete(targetId);
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

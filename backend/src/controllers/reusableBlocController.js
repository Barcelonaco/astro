import { ReusableBloc } from '../models/ReusableBloc.js';

export async function getAllReusableBlocs(req, res) {
  try {
    const blocs = await ReusableBloc.findAll();
    res.json(blocs.map(bloc => ({
      id: bloc.id,
      title: bloc.title,
      content: bloc.content,
      status: bloc.status,
      created_at: bloc.created_at,
      updated_at: bloc.updated_at,
      author: {
        name: bloc.author_name
      }
    })));
  } catch (error) {
    console.error('Error fetching reusable blocs:', error);
    res.status(500).json({ error: 'Failed to fetch reusable blocs' });
  }
}

export async function getReusableBlocById(req, res) {
  try {
    const bloc = await ReusableBloc.findById(req.params.id);

    if (!bloc) {
      return res.status(404).json({ error: 'Reusable bloc not found' });
    }

    res.json({
      id: bloc.id,
      title: bloc.title,
      content: bloc.content,
      status: bloc.status,
      created_at: bloc.created_at,
      updated_at: bloc.updated_at,
      author: {
        name: bloc.author_name
      }
    });
  } catch (error) {
    console.error('Error fetching reusable bloc:', error);
    res.status(500).json({ error: 'Failed to fetch reusable bloc' });
  }
}

export async function createReusableBloc(req, res) {
  try {
    const { title, content, status = 'published' } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const contentValue = content !== undefined && content !== null ? String(content) : '[]';

    const blocId = await ReusableBloc.create({
      title,
      content: contentValue,
      status,
      author_id: req.user.id
    });

    res.status(201).json({ id: blocId, message: 'Reusable bloc created successfully' });
  } catch (error) {
    console.error('Error creating reusable bloc:', error);
    res.status(500).json({ error: 'Failed to create reusable bloc' });
  }
}

export async function updateReusableBloc(req, res) {
  try {
    const { title, content, status } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const contentValue = content !== undefined && content !== null ? String(content) : '[]';

    await ReusableBloc.update(req.params.id, {
      title,
      content: contentValue,
      status
    });

    res.json({ message: 'Reusable bloc updated successfully' });
  } catch (error) {
    console.error('Error updating reusable bloc:', error);
    res.status(500).json({ error: 'Failed to update reusable bloc' });
  }
}

export async function deleteReusableBloc(req, res) {
  try {
    await ReusableBloc.delete(req.params.id);
    res.json({ message: 'Reusable bloc deleted successfully' });
  } catch (error) {
    console.error('Error deleting reusable bloc:', error);
    res.status(500).json({ error: 'Failed to delete reusable bloc' });
  }
}

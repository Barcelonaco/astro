import { Page } from '../models/Page.js';
import db from '../db.js';

export async function getAllPages(req, res) {
  try {
    const pages = await Page.findAll();
    res.json(pages.map(page => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      content: page.content,
      status: page.status,
      show_in_menu: page.show_in_menu,
      menu_order: page.menu_order,
      parent_id: page.parent_id,
      parent_title: page.parent_title,
      created_at: page.created_at,
      updated_at: page.updated_at,
      author: {
        name: page.author_name
      }
    })));
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
}

export async function getPageBySlug(req, res) {
  try {
    const page = await Page.findBySlug(req.params.slug);

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({
      id: page.id,
      title: page.title,
      slug: page.slug,
      content: page.content,
      status: page.status,
      show_in_menu: page.show_in_menu,
      menu_order: page.menu_order,
      parent_id: page.parent_id,
      parent_title: page.parent_title,
      parent_slug: page.parent_slug,
      created_at: page.created_at,
      updated_at: page.updated_at,
      author: {
        name: page.author_name,
        email: page.author_email
      }
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({ error: 'Failed to fetch page' });
  }
}

export async function createPage(req, res) {
  try {
    const { title, slug, content, status = 'draft', show_in_menu = true, menu_order = 0, parent_id = null } = req.body;

    if (!title || !slug) {
      return res.status(400).json({ error: 'Title and slug are required' });
    }
    const contentValue = content !== undefined && content !== null ? String(content) : '';

    const pageId = await Page.create({
      title,
      slug,
      content: contentValue,
      author_id: req.user.id,
      status,
      show_in_menu,
      menu_order,
      parent_id
    });

    res.status(201).json({ id: pageId, message: 'Page created successfully' });
  } catch (error) {
    console.error('Error creating page:', error);
    res.status(500).json({ error: 'Failed to create page' });
  }
}

export async function updatePage(req, res) {
  try {
    const { title, slug, content, status, show_in_menu, menu_order, parent_id } = req.body;

    if (!title || !slug) {
      return res.status(400).json({ error: 'Title and slug are required' });
    }
    const contentValue = content !== undefined && content !== null ? String(content) : '';

    await Page.update(req.params.id, {
      title,
      slug,
      content: contentValue,
      status,
      show_in_menu,
      menu_order,
      parent_id
    });

    res.json({ message: 'Page updated successfully' });
  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({ error: 'Failed to update page' });
  }
}

export async function deletePage(req, res) {
  try {
    const pageId = req.params.id;
    // Remove menu items referencing this page
    await db.query('DELETE FROM menu_items WHERE page_id = ? AND type = ?', [pageId, 'page']);
    await Page.delete(pageId);
    res.json({ message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
}

export async function getNavigation(req, res) {
  try {
    const navigation = await Page.findNavigation();
    res.json(navigation);
  } catch (error) {
    console.error('Error fetching navigation:', error);
    res.status(500).json({ error: 'Failed to fetch navigation' });
  }
}

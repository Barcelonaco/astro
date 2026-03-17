import { Post } from '../models/Post.js';

export const getAllPosts = async (req, res) => {
  try {
    const { status, category } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (category) filters.category = category;

    const posts = await Post.findAll(filters);

    // Format response
    const formattedPosts = posts.map(post => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      featured_image: post.featured_image,
      author: {
        id: post.author_id,
        name: post.author_name
      },
      categories: post.category_ids ? post.category_ids.split(',').map((id, index) => ({
        id: parseInt(id),
        name: post.category_names.split(',')[index]
      })) : [],
      tags: post.tags ? post.tags.split(',') : [],
      published_date: post.published_date,
      status: post.status,
      created_at: post.created_at,
      updated_at: post.updated_at
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const post = await Post.findBySlug(slug);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Format response
    const formattedPost = {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      featured_image: post.featured_image,
      author: {
        id: post.author_id,
        name: post.author_name,
        email: post.author_email
      },
      categories: post.category_ids ? post.category_ids.split(',').map((id, index) => ({
        id: parseInt(id),
        name: post.category_names.split(',')[index],
        slug: post.category_slugs.split(',')[index]
      })) : [],
      tags: post.tags ? post.tags.split(',') : [],
      published_date: post.published_date,
      status: post.status,
      created_at: post.created_at,
      updated_at: post.updated_at
    };

    res.json(formattedPost);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createPost = async (req, res) => {
  try {
    const postData = {
      ...req.body,
      author_id: req.user.id
    };

    const postId = await Post.create(postData);

    if (req.body.categories) {
      await Post.setCategories(postId, req.body.categories);
    }

    if (req.body.tags) {
      await Post.setTags(postId, req.body.tags);
    }

    const post = await Post.findBySlug(req.body.slug);
    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;

    await Post.update(id, req.body);

    if (req.body.categories) {
      await Post.setCategories(id, req.body.categories);
    }

    if (req.body.tags) {
      await Post.setTags(id, req.body.tags);
    }

    const post = await Post.findBySlug(req.body.slug);
    res.json(post);
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    await Post.delete(id);
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

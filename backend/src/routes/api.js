import express from 'express';
import { login, me } from '../controllers/authController.js';
import {
  getAllPosts,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost
} from '../controllers/postController.js';
import {
  getAllCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import {
  getAllPages,
  getPageBySlug,
  createPage,
  updatePage,
  deletePage,
  getNavigation
} from '../controllers/pageController.js';
import {
  getAllSettings,
  getThemeSettings,
  getSiteInfo,
  getStyleSettings,
  getFrontendBootstrap,
  updateSettings
} from '../controllers/settingsController.js';
import { getModuleFields } from '../controllers/moduleFieldsController.js';
import { getAllUsers, createUser, updateUser, deleteUser } from '../controllers/userController.js';
import { getModuleTemplate } from '../controllers/moduleTemplatesController.js';
import {
  mediaUpload,
  getMediaFolders,
  createMediaFolder,
  updateMediaFolder,
  deleteMediaFolder,
  getMediaItems,
  uploadMediaItems,
  updateMediaItem,
  deleteMediaItem
} from '../controllers/mediaController.js';
import { getPlugins } from '../controllers/pluginController.js';
import { renderBlock } from '../controllers/renderBlockController.js';
import {
  getCPTItems, getCPTItemBySlug, createCPTItem, updateCPTItem, deleteCPTItem,
  getCPTCategories, createCPTCategory, updateCPTCategory, deleteCPTCategory
} from '../controllers/customPostTypeController.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Auth routes
router.post('/auth/login', login);
router.get('/auth/me', authenticateToken, me);

// Public posts routes
router.get('/posts', getAllPosts);
router.get('/posts/:slug', getPostBySlug);

// Protected posts routes
router.post('/posts', authenticateToken, createPost);
router.put('/posts/:id', authenticateToken, updatePost);
router.delete('/posts/:id', authenticateToken, deletePost);

// Public categories routes
router.get('/categories', getAllCategories);
router.get('/categories/:slug', getCategoryBySlug);

// Protected categories routes
router.post('/categories', authenticateToken, createCategory);
router.put('/categories/:id', authenticateToken, updateCategory);
router.delete('/categories/:id', authenticateToken, deleteCategory);

// Public pages routes
router.get('/pages', getAllPages);
router.get('/pages/navigation', getNavigation);
router.get('/pages/:slug', getPageBySlug);

// Protected pages routes
router.post('/pages', authenticateToken, createPage);
router.put('/pages/:id', authenticateToken, updatePage);
router.delete('/pages/:id', authenticateToken, deletePage);

// Theme settings (public, for frontend)
router.get('/settings/theme', getThemeSettings);

// Site identity (public, for frontend)
router.get('/settings/site', getSiteInfo);

// Style settings (public, for frontend SSR)
router.get('/settings/style', getStyleSettings);

// Combined bootstrap data (public, for frontend SSR — single request)
router.get('/frontend-bootstrap', getFrontendBootstrap);

// Settings (admin only)
router.get('/settings', authenticateToken, isAdmin, getAllSettings);
router.put('/settings', authenticateToken, isAdmin, updateSettings);

// User management (admin only)
router.get('/users', authenticateToken, isAdmin, getAllUsers);
router.post('/users', authenticateToken, isAdmin, createUser);
router.put('/users/:id', authenticateToken, isAdmin, updateUser);
router.delete('/users/:id', authenticateToken, isAdmin, deleteUser);

// Module fields (admin only)
router.get('/module-fields', authenticateToken, isAdmin, getModuleFields);
router.get('/module-template', authenticateToken, isAdmin, getModuleTemplate);

// Plugins (admin only)
router.get('/plugins', authenticateToken, isAdmin, getPlugins);

// Block rendering (public, for SSR frontend)
router.post('/render-block', renderBlock);

// Media library (admin only)
router.get('/media/folders', authenticateToken, isAdmin, getMediaFolders);
router.post('/media/folders', authenticateToken, isAdmin, createMediaFolder);
router.put('/media/folders/:id', authenticateToken, isAdmin, updateMediaFolder);
router.delete('/media/folders/:id', authenticateToken, isAdmin, deleteMediaFolder);

router.get('/media', authenticateToken, isAdmin, getMediaItems);
router.post('/media/upload', authenticateToken, isAdmin, mediaUpload, uploadMediaItems);
router.put('/media/:id', authenticateToken, isAdmin, updateMediaItem);
router.delete('/media/:id', authenticateToken, isAdmin, deleteMediaItem);

// Custom Post Types (dynamic, from plugins)
router.get('/cpt/:postType', getCPTItems);
router.get('/cpt/:postType/:slug', getCPTItemBySlug);
router.post('/cpt/:postType', authenticateToken, createCPTItem);
router.put('/cpt/:postType/:id', authenticateToken, updateCPTItem);
router.delete('/cpt/:postType/:id', authenticateToken, deleteCPTItem);

// CPT Categories
router.get('/cpt/:postType/categories', getCPTCategories);
router.post('/cpt/:postType/categories', authenticateToken, createCPTCategory);
router.put('/cpt/:postType/categories/:id', authenticateToken, updateCPTCategory);
router.delete('/cpt/:postType/categories/:id', authenticateToken, deleteCPTCategory);

export default router;

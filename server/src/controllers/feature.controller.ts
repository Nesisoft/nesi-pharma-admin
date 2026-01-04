import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/apiResponse';

/**
 * Get all features
 */
export async function getFeatures(req: Request, res: Response): Promise<void> {
  try {
    const { includeArchived, category } = req.query;

    const where: Record<string, unknown> = {};

    // Filter by archived status
    if (includeArchived !== 'true') {
      where.archivedAt = null;
    }

    // Filter by category
    if (category && category !== 'all') {
      where.category = category;
    }

    const features = await prisma.feature.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    sendSuccess(res, features);
  } catch (error) {
    console.error('Get features error:', error);
    sendError(res, 'Failed to fetch features', 500);
  }
}

/**
 * Get a single feature by ID
 */
export async function getFeature(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const feature = await prisma.feature.findUnique({
      where: { id },
      include: {
        tierFeatures: {
          include: {
            tier: {
              select: {
                id: true,
                tier: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!feature) {
      sendError(res, 'Feature not found', 404);
      return;
    }

    sendSuccess(res, feature);
  } catch (error) {
    console.error('Get feature error:', error);
    sendError(res, 'Failed to fetch feature', 500);
  }
}

/**
 * Create a new feature
 */
export async function createFeature(req: Request, res: Response): Promise<void> {
  try {
    const { key, name, description, category } = req.body;

    // Validate required fields
    if (!key || !name) {
      sendError(res, 'Key and name are required', 400);
      return;
    }

    // Check for duplicate key
    const existingFeature = await prisma.feature.findUnique({
      where: { key },
    });

    if (existingFeature) {
      sendError(res, 'A feature with this key already exists', 400);
      return;
    }

    const feature = await prisma.feature.create({
      data: {
        key: key.replace(/\s+/g, '_'),
        name,
        description,
        category: category || 'general',
      },
    });

    sendSuccess(res, feature, 'Feature created successfully', 201);
  } catch (error) {
    console.error('Create feature error:', error);
    sendError(res, 'Failed to create feature', 500);
  }
}

/**
 * Update a feature
 */
export async function updateFeature(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { key, name, description, category, isActive } = req.body;

    const existingFeature = await prisma.feature.findUnique({
      where: { id },
    });

    if (!existingFeature) {
      sendError(res, 'Feature not found', 404);
      return;
    }

    // Check for duplicate key if key is being changed
    if (key && key !== existingFeature.key) {
      const duplicateKey = await prisma.feature.findUnique({
        where: { key },
      });

      if (duplicateKey) {
        sendError(res, 'A feature with this key already exists', 400);
        return;
      }
    }

    const feature = await prisma.feature.update({
      where: { id },
      data: {
        ...(key && { key: key.replace(/\s+/g, '_') }),
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    sendSuccess(res, feature, 'Feature updated successfully');
  } catch (error) {
    console.error('Update feature error:', error);
    sendError(res, 'Failed to update feature', 500);
  }
}

/**
 * Archive a feature (soft delete)
 */
export async function archiveFeature(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existingFeature = await prisma.feature.findUnique({
      where: { id },
    });

    if (!existingFeature) {
      sendError(res, 'Feature not found', 404);
      return;
    }

    if (existingFeature.archivedAt) {
      sendError(res, 'Feature is already archived', 400);
      return;
    }

    const feature = await prisma.feature.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        isActive: false,
      },
    });

    sendSuccess(res, feature, 'Feature archived successfully');
  } catch (error) {
    console.error('Archive feature error:', error);
    sendError(res, 'Failed to archive feature', 500);
  }
}

/**
 * Restore an archived feature
 */
export async function restoreFeature(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existingFeature = await prisma.feature.findUnique({
      where: { id },
    });

    if (!existingFeature) {
      sendError(res, 'Feature not found', 404);
      return;
    }

    if (!existingFeature.archivedAt) {
      sendError(res, 'Feature is not archived', 400);
      return;
    }

    const feature = await prisma.feature.update({
      where: { id },
      data: {
        archivedAt: null,
        isActive: true,
      },
    });

    sendSuccess(res, feature, 'Feature restored successfully');
  } catch (error) {
    console.error('Restore feature error:', error);
    sendError(res, 'Failed to restore feature', 500);
  }
}

/**
 * Permanently delete a feature
 */
export async function deleteFeature(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existingFeature = await prisma.feature.findUnique({
      where: { id },
      include: {
        tierFeatures: true,
      },
    });

    if (!existingFeature) {
      sendError(res, 'Feature not found', 404);
      return;
    }

    // Delete the feature (tier features will cascade delete)
    await prisma.feature.delete({
      where: { id },
    });

    sendSuccess(res, null, 'Feature deleted permanently');
  } catch (error) {
    console.error('Delete feature error:', error);
    sendError(res, 'Failed to delete feature', 500);
  }
}

/**
 * Get all feature categories
 */
export async function getFeatureCategories(req: Request, res: Response): Promise<void> {
  try {
    const categories = await prisma.feature.findMany({
      where: { archivedAt: null },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    const categoryList = categories.map((c) => c.category);

    sendSuccess(res, categoryList);
  } catch (error) {
    console.error('Get feature categories error:', error);
    sendError(res, 'Failed to fetch feature categories', 500);
  }
}

export default {
  getFeatures,
  getFeature,
  createFeature,
  updateFeature,
  archiveFeature,
  restoreFeature,
  deleteFeature,
  getFeatureCategories,
};

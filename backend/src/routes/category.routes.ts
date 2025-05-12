// backend/src/routes/category.routes.ts
import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source'; // CJS: No .js
import { Category } from '../entity/Category';     // CJS: No .js
// We don't strictly need Subcategory import if we use relations correctly

const router = Router();

// GET /api/categories - Fetch all active categories and their active subcategories
router.get('/', async (req: Request, res: Response) => {
  try {
    const categoryRepository = AppDataSource.getRepository(Category);

    // Fetch categories with their subcategories using relations
    // Filter out archived categories AND archived subcategories
    const categories = await categoryRepository.find({
      where: {
        archived: false, // Only get non-archived categories
        subcategories: { // Filter nested relation
            archived: false // Only include non-archived subcategories
        }
      },
      relations: {
        subcategories: true // Eagerly load the subcategories relation
      },
      select: { // Select only the fields needed for the response
        id: true,
        name: true,
        type: true,
        subcategories: { // Select specific fields from the nested relation
          id: true,
          name: true,
          // No need for categoryId or archived status in the response here
        }
      },
      order: { // Optional: order categories and subcategories
        name: "ASC", // Order categories by name
        subcategories: {
          name: "ASC" // Order subcategories by name
        }
      }
    });

    res.json(categories);

  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: 'Server error fetching categories' });
  }
});

// --- Future Endpoints (Example Stubs) ---

// POST /api/categories - Add a new category (Admin only? Or not for POC?)
// router.post('/', async (req: Request, res: Response) => { ... });

// PUT /api/categories/:id/archive - Archive a category
// router.put('/:id/archive', async (req: Request, res: Response) => { ... });

// PUT /api/categories/:id/unarchive - Unarchive a category
// router.put('/:id/unarchive', async (req: Request, res: Response) => { ... });

// Maybe similar endpoints for subcategories? Or manage them through the category?

export default router; // Use export default for CJS compatibility via TS
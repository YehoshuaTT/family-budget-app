// backend/src/routes/category.routes.ts
import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Category } from '../entity/Category';
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';
// IsNull לא נצטרך אותו ישירות כאן עם QueryBuilder

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const typeQuery = req.query.type as string | undefined;

  try {
    const categoryRepository = AppDataSource.getRepository(Category);
    
    let queryBuilder = categoryRepository.createQueryBuilder("category")
      .leftJoinAndSelect("category.subcategories", "subcategory", "subcategory.archived = :isNotArchived", { isNotArchived: false }) // טען תתי-קטגוריות לא מאורכבות
      .where("category.archived = :isNotArchived", { isNotArchived: false })
      .andWhere("(category.userId = :userId OR category.userId IS NULL)", { userId: userId }) // התנאי החשוב כאן
      .orderBy("category.name", "ASC")
      .addOrderBy("subcategory.name", "ASC"); // מיון גם תתי-קטגוריות

    if (typeQuery === 'expense' || typeQuery === 'income') {
      queryBuilder = queryBuilder.andWhere("category.type = :type", { type: typeQuery });
    }
    
    // אם typeQuery הוא לא 'expense', אל תטען תתי-קטגוריות כלל (כי הן רלוונטיות רק להוצאות)
    if (typeQuery !== 'expense') {
        // כדי למנוע טעינה של subcategories, נצטרך לבנות את השאילתה מעט אחרת
        // או פשוט לא להשתמש ב-subcategories בהמשך אם זה income.
        // ה-leftJoinAndSelect למעלה כבר עושה את העבודה, אבל אם זה income, המערך יהיה ריק.
    }

    const categories = await queryBuilder.getMany();
    
    // המיפוי יכול להישאר דומה, אבל כבר אין צורך לסנן subcategories.archived כאן כי ה-DB עשה זאת.
    const responseCategories = categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        name_he: (cat as any).name_he || cat.name, // אם יש לך שדה כזה
        type: cat.type,
        userId: cat.userId,
        subcategories: cat.type === 'expense' ? (cat.subcategories || []).map(sub => ({ // ודא ש-subcategories קיים
            id: sub.id,
            name: sub.name,
            name_he: (sub as any).name_he || sub.name,
        })) : [] // החזר מערך ריק אם זה לא הוצאה
    }));

    res.json(responseCategories);

  } catch (error: any) {
    console.error("Error fetching categories:", error);
    // החזר את השגיאה המקורית לדיבוג טוב יותר
    res.status(500).json({ message: `Server error fetching categories: ${error.message}`, details: error.toString() });
  }
});

export default router;
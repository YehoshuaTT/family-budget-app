// backend/src/seed.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Category } from './entity/Category';
import { Subcategory } from './entity/Subcategory';
import { In } from 'typeorm';

interface SubcategorySeedData {
  name: string;
  // Add any other subcategory specific seed properties here if needed in future
}

interface CategorySeedData {
  name: string;
  type: 'expense' | 'income'; // Explicitly define type
  subcategories?: SubcategorySeedData[] | string[]; // Can be array of objects or strings
}

// =================================================================
// DEFINE CATEGORIES DATA
// =================================================================
const categoriesData: CategorySeedData[] = [
  // --- Expense Categories (as before) ---
  { name: "מזון ופארמה", type: "expense", subcategories: [ "מזון ופארמה - כללי", "בר מים", "אוכל מוכן / בעבודה", "פארמה וטואלטיקה", "מזון", "עישון" ]},
  { name: "פנאי, בילוי ותחביבים", type: "expense", subcategories: [ "בייביסיטר", "פנאי - כללי", "חוגי מבוגרים", "מסעדה ואוכל בחוץ", "חיות מחמד", "הגרלות", "ספורט", "חופשות", "בילויים ומופעים" ]},
  { name: "ביגוד והנעלה", type: "expense", subcategories: [ "ביגוד הורים", "ביגוד ילדים", "נעליים", "ביגוד והנעלה - כללי" ]},
  { name: "תכולת בית", type: "expense", subcategories: [ "ריהוט", "מוצרי חשמל ואלקטרוניקה", "משחקים, צעצועים וספרים", "כלי בית", "תכולת בית - כללי" ]},
  { name: "אחזקת בית", type: "expense", subcategories: [ "גינה", "מים וביוב", "חשמל", "גז", "אחזקת בית - כללי", "תיקונים בבית / במכשירים", "ניקיון" ]},
  { name: "טיפוח", type: "expense", subcategories: [ "קוסמטיקה", "טיפוח - כללי", "מספרה" ]},
  { name: "חינוך", type: "expense", subcategories: [ "מסגרות יום", "מסגרות צהריים", "הסעות", "בית ספר", "מסגרות קיץ", "צהרון / מטפלת", "שיעור פרטי", "לימודים והשתלמות לבוגרים", "חינוך - כללי", "חוגים ותנועת נוער" ]},
  { name: "אירועים, תרומות, צרכי דת", type: "expense", subcategories: [ "אירוע בעבודה / לחברים", "תרומות", "חגים וצורכי דת" ]},
  { name: "בריאות", type: "expense", subcategories: [ "תשלום לקופ\"ח", "טיפולים פרטיים", "ביטוח רפואי נוסף", "תרופות", "בריאות - כללי", "טיפולי שיניים / אורתודנט", "אופטיקה" ]},
  { name: "תחבורה", type: "expense", subcategories: [ "ליסינג", "תחבורה שיתופית", "רישוי רכב", "חניה", "תחבורה - כללי", "כבישי אגרה", "ביטוח רכב", "תחזוקת רכב", "תחבורה ציבורית", "דלק" ]},
  { name: "משפחה", type: "expense", subcategories: [ "תשלום מזונות", "עזרה למשפחה", "משפחה - כללי", "חיסכון לבר מצווה אור דוד ועדי ישראל", "דמי כיס", "אירועי שמחות במשפחה" ]},
  { name: "תקשורת", type: "expense", subcategories: [ "שירותי תוכן", "טלוויזיה ואינטרנט (ספק ותשתית)", "תקשורת - כללי", "טלפון נייד ונייח" ]},
  { name: "דיור", type: "expense", subcategories: [ "דיור - כללי", "ביטוח נכס ותכולה", "משכנתה", "שכר דירה", "מיסי יישוב / ועד בית", "ארנונה" ]},
  { name: "התחייבויות", type: "expense", subcategories: [ "החזר חובות חודשי (למעט משכנתה) - כללי", "ריביות משיכת יתר" ]},
  { name: "נכסים", type: "expense", subcategories: [ "הפקדות לחסכונות - כללי" ]}, // Still 'expense' as per previous structure; consider if this is correct. Often savings are transfers, not expenses.
  { name: "פיננסים", type: "expense", subcategories: [ "עמלות", "ביטוח חיים", "פיננסים - כללי", "ביטוח לאומי (למי שלא עובד)" ]},

  // --- Income Categories (NEW) ---
  { name: "שכר עבודה", type: "income", subcategories: [ "שכר עבודה - כללי", "שכר עבודה 1", "שכר עבודה 2" ] }, // "שכר עבודה - כללי" for simpler cases
  { name: "קצבאות וגמלאות", type: "income", subcategories: [ "קצבת ילדים", "קצבת נכות", "דמי אבטלה", "פנסיה/גמלה", "קצבאות אחרות - כללי" ] },
  { name: "הכנסות מנכסים והשקעות", type: "income", subcategories: [ "שכר דירה (מהשכרת נכס)", "דיבידנדים", "רווחי הון", "הכנסה פיננסית אחרת - כללי" ] },
  { name: "עסק עצמאי / פרילנס", type: "income", subcategories: [ "עסק עצמאי - כללי" ] }, // User can create more specific ones later if needed
  { name: "סיוע ותמיכות", type: "income", subcategories: [ "סיוע בשכר דירה", "עזרה ממשפחה", "קבלת מזונות" ] },
  { name: "הכנסות שונות", type: "income", subcategories: [ "מתנות (כסף)", "החזרים", "מכירת חפצים", "הכנסות שונות - כללי" ] },
];
// =================================================================

const seedDatabase = async () => {
  try {
    console.log('SEED: Attempting to initialize Data Source...');
    await AppDataSource.initialize();
    console.log('SEED: Data Source initialized successfully.');

    const categoryRepository = AppDataSource.getRepository(Category);
    const subcategoryRepository = AppDataSource.getRepository(Subcategory);
    let categoriesCreated = 0;
    let subcategoriesCreated = 0;

    console.log(`\nSEED: Processing ${categoriesData.length} primary categories...`);

    for (const catData of categoriesData) {
      // 1. Find or Create Category
      let category = await categoryRepository.findOneBy({ name: catData.name, type: catData.type });

      if (!category) {
        console.log(` -> Creating Category: "${catData.name}" (Type: ${catData.type})`);
        category = categoryRepository.create({
          name: catData.name,
          type: catData.type,
          archived: false,
        });
        await categoryRepository.save(category);
        categoriesCreated++;
      } else {
        console.log(` -> Category "${catData.name}" (Type: ${catData.type}) already exists (ID: ${category.id}). Checking subcategories...`);
      }

      // 2. Find or Create Subcategories for this Category (Only if it's an 'expense' type for now, or adjust as needed)
      if (category && catData.type === 'expense' && catData.subcategories && catData.subcategories.length > 0) {
        const subNames = catData.subcategories.map(sub => (typeof sub === 'string' ? sub : sub.name));

        const existingSubcategories = await subcategoryRepository.find({
          where: {
            categoryId: category.id,
            name: In(subNames)
          },
          select: ["name"]
        });
        const existingSubNames = existingSubcategories.map(sub => sub.name);
        console.log(`    Found ${existingSubNames.length} existing subcategories for expense category "${category.name}": [${existingSubNames.join(', ')}]`);

        const subcategoriesToCreate: Partial<Subcategory>[] = [];

        for (const subItem of catData.subcategories) {
          const subName = typeof subItem === 'string' ? subItem : subItem.name;
          if (!existingSubNames.includes(subName)) {
            subcategoriesToCreate.push({
              name: subName,
              category: category,
              archived: false,
            });
            console.log(`    -> Queued new Subcategory: "${subName}"`);
          }
        }

        if (subcategoriesToCreate.length > 0) {
          console.log(`    => Attempting to save ${subcategoriesToCreate.length} new subcategories for "${category.name}"...`);
          const newSubEntities = subcategoryRepository.create(subcategoriesToCreate);
          await subcategoryRepository.save(newSubEntities);
          subcategoriesCreated += subcategoriesToCreate.length;
          console.log(`    ==> Saved ${subcategoriesToCreate.length} new subcategories for "${category.name}".`);
        } else {
          console.log(`    -> No new subcategories needed for "${category.name}".`);
        }
      } else if (catData.type === 'income') {
        // For income categories, we currently don't have a separate Subcategory entity.
        // The Category itself serves as the classification.
        // If you decide to add subcategories for income later, this logic would need expansion.
        console.log(`    -> Category "${catData.name}" is of type 'income'. No subcategories to process from seed data.`);
      }
      console.log(` --- Finished processing category "${catData.name}" ---`);
    } // end category loop

    console.log('\n==========================================');
    console.log('SEED Summary:');
    console.log(` - Categories Created: ${categoriesCreated}`);
    console.log(` - Subcategories Created: ${subcategoriesCreated}`); // Will be 0 if only income categories were new
    if (categoriesCreated === 0 && subcategoriesCreated === 0) {
      console.log('   (No changes needed, database was already seeded or no new expense categories with subs)');
    }
    console.log('==========================================');
    console.log('SEED: Seeding process completed.');

  } catch (error) {
    console.error('SEED: Error during database seeding:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('SEED: Data Source connection closed.');
    }
  }
};

seedDatabase();
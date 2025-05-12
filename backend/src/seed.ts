// backend/src/seed.ts
import 'reflect-metadata'; // Keep this if needed, though often not strictly required for seeders unless using complex decorators within the seeder itself
import { AppDataSource } from './data-source'; // CJS: No .js
import { Category } from './entity/Category';     // CJS: No .js
import { Subcategory } from './entity/Subcategory'; // CJS: No .js
import { In } from 'typeorm';                      // Import 'In' operator

interface CategorySeedData {
  name: string;
  type?: 'expense' | 'income'; // Optional type, defaults to 'expense'
  subcategories: string[];
}

// =================================================================
// DEFINE CATEGORIES DATA
// (Using the structure you provided)
// =================================================================
const categoriesData: CategorySeedData[] = [
  { name: "מזון ופארמה", subcategories: [ "מזון ופארמה - כללי", "בר מים", "אוכל מוכן / בעבודה", "פארמה וטואלטיקה", "מזון", "עישון" ]},
  { name: "פנאי, בילוי ותחביבים", subcategories: [ "בייביסיטר", "פנאי - כללי", "חוגי מבוגרים", "מסעדה ואוכל בחוץ", "חיות מחמד", "הגרלות", "ספורט", "חופשות", "בילויים ומופעים" ]},
  { name: "ביגוד והנעלה", subcategories: [ "ביגוד הורים", "ביגוד ילדים", "נעליים", "ביגוד והנעלה - כללי" ]},
  { name: "תכולת בית", subcategories: [ "ריהוט", "מוצרי חשמל ואלקטרוניקה", "משחקים, צעצועים וספרים", "כלי בית", "תכולת בית - כללי" ]},
  { name: "אחזקת בית", subcategories: [ "גינה", "מים וביוב", "חשמל", "גז", "אחזקת בית - כללי", "תיקונים בבית / במכשירים", "ניקיון" ]},
  { name: "טיפוח", subcategories: [ "קוסמטיקה", "טיפוח - כללי", "מספרה" ]},
  { name: "חינוך", subcategories: [ "מסגרות יום", "מסגרות צהריים", "הסעות", "בית ספר", "מסגרות קיץ", "צהרון / מטפלת", "שיעור פרטי", "לימודים והשתלמות לבוגרים", "חינוך - כללי", "חוגים ותנועת נוער" ]},
  { name: "אירועים, תרומות, צרכי דת", subcategories: [ "אירוע בעבודה / לחברים", "תרומות", "חגים וצורכי דת" ]},
  { name: "בריאות", subcategories: [ "תשלום לקופ\"ח", "טיפולים פרטיים", "ביטוח רפואי נוסף", "תרופות", "בריאות - כללי", "טיפולי שיניים / אורתודנט", "אופטיקה" ]},
  { name: "תחבורה", subcategories: [ "ליסינג", "תחבורה שיתופית", "רישוי רכב", "חניה", "תחבורה - כללי", "כבישי אגרה", "ביטוח רכב", "תחזוקת רכב", "תחבורה ציבורית", "דלק" ]},
  { name: "משפחה", subcategories: [ "תשלום מזונות", "עזרה למשפחה", "משפחה - כללי", "חיסכון לבר מצווה אור דוד ועדי ישראל", "דמי כיס", "אירועי שמחות במשפחה" ]},
  { name: "תקשורת", subcategories: [ "שירותי תוכן", "טלוויזיה ואינטרנט (ספק ותשתית)", "תקשורת - כללי", "טלפון נייד ונייח" ]},
  { name: "דיור", subcategories: [ "דיור - כללי", "ביטוח נכס ותכולה", "משכנתה", "שכר דירה", "מיסי יישוב / ועד בית", "ארנונה" ]},
  { name: "התחייבויות", subcategories: [ "החזר חובות חודשי (למעט משכנתה) - כללי", "ריביות משיכת יתר" ]},
  { name: "נכסים", subcategories: [ "הפקדות לחסכונות - כללי" ]}, // Consider if this should be 'expense' or a different type
  { name: "פיננסים", subcategories: [ "עמלות", "ביטוח חיים", "פיננסים - כללי", "ביטוח לאומי (למי שלא עובד)" ]},
  // --- Income Categories Example (uncomment and adjust if needed) ---
  // { name: "הכנסות שוטפות", type: "income", subcategories: ["משכורת", "עסק", "קצבאות", "הכנסה אחרת"]},
  // { name: "הכנסות הוניות", type: "income", subcategories: ["מתנות", "ירושות", "מכירת נכסים", "הכנסה הונית אחרת"]},
];
// =================================================================

/**
 * Seeds the database with default categories and subcategories.
 * Checks for existence before creating to allow safe re-running.
 */
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
       const categoryType = catData.type || 'expense'; // Default to 'expense'

      // 1. Find or Create Category
      // Check if a category with this name ALREADY exists
       let category = await categoryRepository.findOneBy({ name: catData.name });

       if (!category) {
         console.log(` -> Creating Category: "${catData.name}" (Type: ${categoryType})`);
         category = categoryRepository.create({
          name: catData.name,
          type: categoryType,
          archived: false, // New categories are not archived
         });
         await categoryRepository.save(category);
         categoriesCreated++;
       } else {
         console.log(` -> Category "${catData.name}" already exists (ID: ${category.id}). Checking subcategories...`);
         // Optional: Update type or other fields if needed for existing categories
         // if (category.type !== categoryType) {
         //   category.type = categoryType;
         //   await categoryRepository.save(category);
         //   console.log(`    Updated type for "${category.name}" to ${categoryType}`);
         // }
       }

      // 2. Find or Create Subcategories for this Category
      if (category && catData.subcategories?.length > 0) {
        // Find existing subcategories for this category ID and names provided
         const existingSubcategories = await subcategoryRepository.find({
           where: {
             categoryId: category.id,
             name: In(catData.subcategories) // Check only for names in the current seed list
           },
           select: ["name"] // Only need the names for comparison
         });
         const existingSubNames = existingSubcategories.map(sub => sub.name);
         console.log(`    Found ${existingSubNames.length} existing subcategories for "${category.name}": [${existingSubNames.join(', ')}]`);

         const subcategoriesToCreate: Partial<Subcategory>[] = [];

         for (const subName of catData.subcategories) {
           // If this subName is NOT among the existing ones for this category
           if (!existingSubNames.includes(subName)) {
               subcategoriesToCreate.push({
                 name: subName,
                 category: category, // Link to the parent Category object for the relation
                 archived: false,    // New subcategories are not archived
               });
             console.log(`    -> Queued new Subcategory: "${subName}"`);
           }
         }

         // Bulk-create all the new subcategories needed for this category
         if (subcategoriesToCreate.length > 0) {
             console.log(`    => Attempting to save ${subcategoriesToCreate.length} new subcategories...`);
             const newSubEntities = subcategoryRepository.create(subcategoriesToCreate);
             await subcategoryRepository.save(newSubEntities);
             subcategoriesCreated += subcategoriesToCreate.length;
             console.log(`    ==> Saved ${subcategoriesToCreate.length} new subcategories for "${category.name}".`);
         } else {
             console.log(`    -> No new subcategories needed for "${category.name}".`);
         }
       }
       console.log(` --- Finished processing category "${catData.name}" ---`);
    } // end category loop

    console.log('\n==========================================');
    console.log('SEED Summary:');
    console.log(` - Categories Created: ${categoriesCreated}`);
    console.log(` - Subcategories Created: ${subcategoriesCreated}`);
    if (categoriesCreated === 0 && subcategoriesCreated === 0) {
      console.log('   (No changes needed, database was already seeded)');
    }
    console.log('==========================================');
    console.log('SEED: Seeding process completed.');

  } catch (error) {
    console.error('SEED: Error during database seeding:', error);
    process.exit(1); // Exit with error code
  } finally {
    // Ensure the connection is closed even if errors occurred (or if successful)
    if (AppDataSource.isInitialized) {
       await AppDataSource.destroy();
       console.log('SEED: Data Source connection closed.');
    }
  }
};

seedDatabase();
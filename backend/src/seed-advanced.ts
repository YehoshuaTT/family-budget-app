// backend/src/seed-advanced.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { User } from './entity/User';
import { Category } from './entity/Category';
import { Subcategory } from './entity/Subcategory';
import { Income } from './entity/Income';
import { Expense, ExpenseType } from './entity/Expense';
import { RecurringExpenseDefinition, Frequency } from './entity/RecurringExpenseDefinition';
import { InstallmentTransaction } from './entity/InstallmentTransaction';
import { UserSettings } from './entity/UserSettings';
import { faker } from '@faker-js/faker/locale/he'; // Faker עם לוקליזציה לעברית
import { addMonths, subMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, addDays, addWeeks, getDay } from 'date-fns';
import bcrypt from 'bcryptjs';
import { Budget } from './entity/Budget'; // <-- הוסף ייבוא

const NUMBER_OF_USERS = 2;
const MONTHS_OF_DATA = 4; // Number of past months + current month

const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomNumber = (min: number, max: number, precision: number = 2) => 
    parseFloat((Math.random() * (max - min) + min).toFixed(precision));

const seedDatabase = async () => {
  try {
    console.log('ADV_SEED: Initializing Data Source...');
    await AppDataSource.initialize();
    console.log('ADV_SEED: Data Source initialized.');
    
    const budgetRepository = AppDataSource.getRepository(Budget); // <-- הוסף Repository
    const userRepository = AppDataSource.getRepository(User);
    const categoryRepository = AppDataSource.getRepository(Category);
    const subcategoryRepository = AppDataSource.getRepository(Subcategory);
    const incomeRepository = AppDataSource.getRepository(Income);
    const expenseRepository = AppDataSource.getRepository(Expense);
    const recurringDefRepository = AppDataSource.getRepository(RecurringExpenseDefinition);
    const installmentRepo = AppDataSource.getRepository(InstallmentTransaction);
    const userSettingsRepo = AppDataSource.getRepository(UserSettings);

    // --- 0. Ensure Base Categories and Subcategories Exist (from previous seed) ---
    // This part assumes your previous seed.ts ran and created base categories.
    // If not, you'd need to include that logic here as well.
    console.log('ADV_SEED: Verifying base categories...');
    let foodCategory = await categoryRepository.findOneBy({ name: "מזון ופארמה", type: "expense" });
    if (!foodCategory) {
        console.error("Base categories not found. Please run the initial category seed first.");
        // return; // Or create them here
        // For now, let's assume they exist from the previous seed.
        // You can copy the category creation logic from the other seed file here if needed.
    }
    const allExpenseCategories = await categoryRepository.find({ where: { type: 'expense'}, relations: ['subcategories'] });
    const allIncomeCategories = await categoryRepository.find({ where: { type: 'income'} });

    if (allExpenseCategories.length === 0 || allIncomeCategories.length === 0) {
        console.error("No expense or income categories found. Please run the category seeder first.");
        return;
    }
    
    console.log(`ADV_SEED: Found ${allExpenseCategories.length} expense categories and ${allIncomeCategories.length} income categories.`);


    // --- 1. Create Users ---
    const users: User[] = [];
    for (let i = 0; i < NUMBER_OF_USERS; i++) {
      const email = faker.internet.email();
      let user = await userRepository.findOneBy({ email });
      if (!user) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);
        user = userRepository.create({
          email,
          password: hashedPassword,
          name: faker.person.firstName() + " " + faker.person.lastName(),
        });
        await userRepository.save(user);
        console.log(`ADV_SEED: Created User: ${user.email}`);
      } else {
        console.log(`ADV_SEED: User ${user.email} already exists.`);
      }
      users.push(user);
    }

    // --- Process for each user ---
    for (const user of users) {
      console.log(`\nADV_SEED: Processing data for user: ${user.email} (ID: ${user.id})`);

      // --- 2. User Settings (Budget Goal) ---
      let settings = await userSettingsRepo.findOneBy({ userId: user.id });
      if (!settings) {
        settings = userSettingsRepo.create({
          user: user,
          userId: user.id,
          defaultCurrency: 'ILS',
          monthlyBudgetGoal: getRandomNumber(5000, 15000, 0),
        });
        await userSettingsRepo.save(settings);
        console.log(`ADV_SEED: Created UserSettings for ${user.email} with budget ${settings.monthlyBudgetGoal}`);
      }

      // --- 3. Create "Custom" Categories for this user (optional) ---
      const customCategoryName = `קטגוריה אישית של ${user.name}`;
      let customCategory = await categoryRepository.findOneBy({ name: customCategoryName, userId: user.id, type: 'expense' });
      // For user-specific categories, you'd need a userId field in Category entity, or handle it differently.
      // For this seed, we'll assume categories are global for simplicity of the current model.
      // If you add userId to Category, uncomment and adapt:
      
      if (!customCategory) {
        customCategory = categoryRepository.create({
          name: customCategoryName,
          type: 'expense',
          archived: false,
          // userId: user.id // if Category entity has userId
        });
        await categoryRepository.save(customCategory);
        const sub1 = subcategoryRepository.create({name: "תת אישי 1", category: customCategory, archived: false});
        const sub2 = subcategoryRepository.create({name: "תת אישי 2", category: customCategory, archived: false});
        await subcategoryRepository.save([sub1, sub2]);
        }
        allExpenseCategories.push(await categoryRepository.findOneOrFail({where: {id: customCategory.id}, relations:['subcategories']}));
        console.log(`ADV_SEED: Created custom category and subcategories for ${user.email}`);
        


      // --- 4. Generate Data for Past and Current Months ---
      const today = new Date();
      for (let monthOffset = MONTHS_OF_DATA - 1; monthOffset >= 0; monthOffset--) {
        const currentIterationMonthStart = startOfMonth(subMonths(today, monthOffset));
        const currentIterationMonthEnd = endOfMonth(currentIterationMonthStart);
        console.log(`ADV_SEED: Generating data for ${user.email} for month: ${format(currentIterationMonthStart, 'yyyy-MM')}`);

        // A. Incomes (1-3 per month)
        for (let i = 0; i < getRandomNumber(1, 3, 0); i++) {
          const randomIncomeCategory = getRandomElement(allIncomeCategories);
          const income = incomeRepository.create({
            user, userId: user.id,
            amount: getRandomNumber(3000, 15000),
            date: format(faker.date.between({ from: currentIterationMonthStart, to: currentIterationMonthEnd }), 'yyyy-MM-dd'),
            description: `${randomIncomeCategory.name} - ${faker.lorem.words(2)}`,
            category: randomIncomeCategory,
            categoryId: randomIncomeCategory.id,
          });
          await incomeRepository.save(income);
        }

        // B. Single Expenses (10-20 per month)
        for (let i = 0; i < getRandomNumber(10, 20, 0); i++) {
          const randomExpenseCategory = getRandomElement(allExpenseCategories.filter(c => c.subcategories && c.subcategories.length > 0));
          if (!randomExpenseCategory || !randomExpenseCategory.subcategories || randomExpenseCategory.subcategories.length === 0) continue;
          const randomSubcategory = getRandomElement(randomExpenseCategory.subcategories);
          
          const expense = expenseRepository.create({
            user, userId: user.id,
            amount: getRandomNumber(20, 500),
            date: format(faker.date.between({ from: currentIterationMonthStart, to: currentIterationMonthEnd }), 'yyyy-MM-dd'),
            description: `${randomSubcategory.name} - ${faker.lorem.words(1)}`,
            subcategory: randomSubcategory,
            subcategoryId: randomSubcategory.id,
            expenseType: 'single',
            isProcessed: true, // Past expenses are processed
          });
          await expenseRepository.save(expense);
        }
      } // End month loop


      console.log(`ADV_SEED: Generating budgets for user: ${user.email}`);
      const expenseSubcategories = await subcategoryRepository.find({
        relations: ['category'], // Load category to filter by type if necessary
        where: { category: { type: 'expense', archived: false }, archived: false } // Only active expense subcategories
      });

      if (expenseSubcategories.length > 0) {
        for (let monthOffset = MONTHS_OF_DATA - 1; monthOffset >= 0; monthOffset--) {
          const currentIterationMonthStart = startOfMonth(subMonths(today, monthOffset));
          const year = currentIterationMonthStart.getFullYear();
          const month = currentIterationMonthStart.getMonth() + 1; // 1-12 for DB

          // Create budget for a subset of subcategories (e.g., 3-5 random ones)
          const subcategoriesToBudget = faker.helpers.arrayElements(expenseSubcategories, getRandomNumber(3, 5, 0));

          for (const subcat of subcategoriesToBudget) {
            // Check if budget entry already exists for this user, subcat, year, month
            const existingBudget = await budgetRepository.findOneBy({
              userId: user.id,
              subcategoryId: subcat.id,
              year: year,
              month: month
            });

            if (!existingBudget) {
              const allocatedAmount = getRandomNumber(100, 800, 0); // Random budget amount
              const budgetEntry = budgetRepository.create({
                user, userId: user.id,
                subcategory: subcat, subcategoryId: subcat.id,
                year,
                month,
                allocatedAmount,
              });
              await budgetRepository.save(budgetEntry);
              console.log(`ADV_SEED: Created budget for ${user.email} - ${subcat.name} (${year}-${month}): ${allocatedAmount}`);
            } else {
              console.log(`ADV_SEED: Budget for ${user.email} - ${subcat.name} (${year}-${month}) already exists.`);
            }
          }
        }
      }


      // --- 5. Create Recurring Expense Definitions & Instances ---
      console.log(`ADV_SEED: Creating recurring definitions for ${user.email}`);
      const recurringSamples = [
        { freq: 'monthly', interval: 1, desc: 'מנוי חודשי לחדר כושר', amountRange: [150, 300] },
        { freq: 'monthly', interval: 1, desc: 'שירותי סטרימינג', amountRange: [30, 100] },
        { freq: 'annually', interval: 1, desc: 'ביטוח רכב שנתי', amountRange: [2000, 5000], occurrences: 2 }, // For 2 years
      ];

      for (const sample of recurringSamples) {
        const randomExpenseCategory = getRandomElement(allExpenseCategories.filter(c => c.subcategories && c.subcategories.length > 0));
        if (!randomExpenseCategory || !randomExpenseCategory.subcategories || randomExpenseCategory.subcategories.length === 0) continue;
        const randomSubcategory = getRandomElement(randomExpenseCategory.subcategories);

        const definition = recurringDefRepository.create({
          user, userId: user.id,
          subcategory: randomSubcategory, subcategoryId: randomSubcategory.id,
          amount: getRandomNumber(sample.amountRange[0], sample.amountRange[1]),
          description: sample.desc,
          frequency: sample.freq as Frequency,
          interval: sample.interval,
          startDate: format(subMonths(startOfMonth(today), getRandomNumber(2, MONTHS_OF_DATA-1, 0)), 'yyyy-MM-dd'), // Start in a past month
          occurrences: sample.occurrences, // Can be undefined
          isActive: true,
        });
        definition.nextDueDate = definition.startDate; // Initial
        const savedDef = await recurringDefRepository.save(definition);

        // Generate instances for this definition
        const instances: Partial<Expense>[] = [];
        let currentDueDate = parseISO(savedDef.startDate);
        const finalEndDate = savedDef.endDate ? parseISO(savedDef.endDate) : null;
        let occurrencesCount = 0;
        const MAX_INSTANCES_REC = 36; // Max 3 years of monthly for example

        while (instances.length < MAX_INSTANCES_REC) {
            if (finalEndDate && currentDueDate > finalEndDate) break;
            if (savedDef.occurrences && occurrencesCount >= savedDef.occurrences) break;

            instances.push({
                amount: savedDef.amount, date: format(currentDueDate, 'yyyy-MM-dd'),
                description: savedDef.description, paymentMethod: savedDef.paymentMethod,
                user: user, userId: user.id, subcategory: randomSubcategory, subcategoryId: randomSubcategory.id,
                expenseType: 'recurring_instance', parentId: savedDef.id,
                isProcessed: currentDueDate <= today, // Process if due date is past or today
            });
            occurrencesCount++;

            let nextDate = new Date(currentDueDate); // Create new date object for manipulation
            switch (savedDef.frequency) {
                case 'daily': nextDate.setDate(nextDate.getDate() + savedDef.interval); break;
                case 'weekly': nextDate.setDate(nextDate.getDate() + (7 * savedDef.interval)); break;
                case 'monthly': nextDate = addMonths(nextDate, savedDef.interval); break;
                // Add other frequencies if needed
                default: nextDate = addMonths(nextDate, savedDef.interval);
            }
            currentDueDate = nextDate; // Update currentDueDate for next iteration
        }
        if (instances.length > 0) {
            const expenseEntities = expenseRepository.create(instances);
            await expenseRepository.save(expenseEntities);
            // Update nextDueDate for the definition
            if(currentDueDate <= (finalEndDate || new Date('2999-12-31')) && (!savedDef.occurrences || occurrencesCount < savedDef.occurrences)) {
                savedDef.nextDueDate = format(currentDueDate, 'yyyy-MM-dd');
            } else {
                savedDef.nextDueDate = null;
                savedDef.isActive = false; // All instances generated
            }
            await recurringDefRepository.save(savedDef);
        }
      }


      // --- 6. Create Installment Transactions & Payments ---
      console.log(`ADV_SEED: Creating installment transactions for ${user.email}`);
      for (let i=0; i< getRandomNumber(1,3,0); i++) {
        const randomExpenseCategory = getRandomElement(allExpenseCategories.filter(c => c.subcategories && c.subcategories.length > 0));
        if (!randomExpenseCategory || !randomExpenseCategory.subcategories || randomExpenseCategory.subcategories.length === 0) continue;
        const randomSubcategory = getRandomElement(randomExpenseCategory.subcategories);

        const totalAmount = getRandomNumber(500, 5000);
        const numberOfInstallments = getRandomElement([3, 6, 10, 12]);
        const firstPaymentDate = format(subMonths(startOfMonth(today), getRandomNumber(1, MONTHS_OF_DATA -2, 0)), 'yyyy-MM-dd');
        const baseInstallmentAmount = parseFloat((totalAmount / numberOfInstallments).toFixed(2));
        const lastPaymentAmount = parseFloat((totalAmount - (baseInstallmentAmount * (numberOfInstallments - 1))).toFixed(2));

        const transaction = installmentRepo.create({
            user, userId: user.id,
            subcategory: randomSubcategory, subcategoryId: randomSubcategory.id,
            totalAmount, numberOfInstallments, installmentAmount: baseInstallmentAmount,
            description: `רכישה גדולה בתשלומים - ${faker.commerce.productName()}`,
            firstPaymentDate, isCompleted: false,
        });
        const savedTrans = await installmentRepo.save(transaction);

        const payments: Partial<Expense>[] = [];
        let currentPaymentDate = parseISO(savedTrans.firstPaymentDate);
        for (let j = 0; j < numberOfInstallments; j++) {
            payments.push({
                amount: (j === numberOfInstallments - 1) ? lastPaymentAmount : baseInstallmentAmount,
                date: format(currentPaymentDate, 'yyyy-MM-dd'),
                description: `${savedTrans.description} (תשלום ${j+1}/${numberOfInstallments})`,
                user: user, userId: user.id, subcategory: randomSubcategory, subcategoryId: randomSubcategory.id,
                expenseType: 'installment_instance', parentId: savedTrans.id,
                isProcessed: currentPaymentDate <= today,
            });
            if (j < numberOfInstallments - 1) {
                currentPaymentDate = addMonths(currentPaymentDate, 1);
            }
        }
        if (payments.length > 0) {
            const expenseEntities = expenseRepository.create(payments);
            await expenseRepository.save(expenseEntities);
            // Check if all installments are processed
            const allProcessed = payments.every(p => p.isProcessed);
            if (allProcessed) {
                savedTrans.isCompleted = true;
                await installmentRepo.save(savedTrans);
            }
        }
      }

    } // End user loop

    console.log('\nADV_SEED: Advanced seeding finished successfully.');

  } catch (error) {
    console.error('ADV_SEED: Error during advanced seeding:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('ADV_SEED: Data Source destroyed.');
    }
  }
};

seedDatabase();
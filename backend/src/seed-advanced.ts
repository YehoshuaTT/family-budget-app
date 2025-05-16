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
import { Budget } from './entity/Budget'; // ודא שהנתיב נכון
import { BudgetProfile } from './entity/BudgetProfile'; // ודא שהנתיב נכון
import { faker } from '@faker-js/faker/locale/he';
import { addMonths, subMonths, format, startOfMonth, endOfMonth, parseISO, startOfYear } from 'date-fns';
import bcrypt from 'bcryptjs';

const NUMBER_OF_USERS = 2;
const MONTHS_OF_DATA = 4;

const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomNumber = (min: number, max: number, precision: number = 2) =>
    parseFloat((Math.random() * (max - min) + min).toFixed(precision));

const seedDatabase = async () => {
  try {
    console.log('ADV_SEED: Initializing Data Source...');
    await AppDataSource.initialize();
    console.log('ADV_SEED: Data Source initialized.');

    const userRepository = AppDataSource.getRepository(User);
    const categoryRepository = AppDataSource.getRepository(Category);
    const subcategoryRepository = AppDataSource.getRepository(Subcategory);
    const incomeRepository = AppDataSource.getRepository(Income);
    const expenseRepository = AppDataSource.getRepository(Expense);
    const recurringDefRepository = AppDataSource.getRepository(RecurringExpenseDefinition);
    const installmentRepo = AppDataSource.getRepository(InstallmentTransaction);
    const userSettingsRepo = AppDataSource.getRepository(UserSettings);
    const budgetRepository = AppDataSource.getRepository(Budget);
    const budgetProfileRepository = AppDataSource.getRepository(BudgetProfile); // <-- Repository חדש

    // ... (ודא שקטגוריות בסיס קיימות - כמו קודם) ...
    console.log('ADV_SEED: Verifying base categories...');
    const allExpenseCategories = await categoryRepository.find({ where: { type: 'expense', archived: false }, relations: ['subcategories'] });
    const allIncomeCategories = await categoryRepository.find({ where: { type: 'income', archived: false } });
    if (allExpenseCategories.length === 0 || allIncomeCategories.length === 0) {
        console.error("No expense or income categories found. Please run the category seeder first.");
        return;
    }
    console.log(`ADV_SEED: Found ${allExpenseCategories.length} expense categories and ${allIncomeCategories.length} income categories.`);


    // --- 1. Create Users ---
    const users: User[] = [];
    // ... (קוד יצירת משתמשים כמו קודם) ...
    for (let i = 0; i < NUMBER_OF_USERS; i++) {
      const email = faker.internet.email({firstName: `user${i+1}`, lastName: 'test', provider: 'example.com'});
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
      // ... (כמו קודם) ...
      let settings = await userSettingsRepo.findOneBy({ userId: user.id });
      if (!settings) {
        settings = userSettingsRepo.create({
          user: user, userId: user.id, defaultCurrency: 'ILS',
          monthlyBudgetGoal: getRandomNumber(5000, 15000, 0),
        });
        await userSettingsRepo.save(settings);
        console.log(`ADV_SEED: Created UserSettings for ${user.email} with budget ${settings.monthlyBudgetGoal}`);
      }


      // --- NEW: Create a default Budget Profile for the user ---
      let defaultBudgetProfile = await budgetProfileRepository.findOneBy({ userId: user.id, isActive: true });
      if (!defaultBudgetProfile) {
        defaultBudgetProfile = budgetProfileRepository.create({
          user: user,
          userId: user.id,
          name: `תקציב ראשי ${new Date().getFullYear()}`,
          isActive: true,
          startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
          // endDate can be null for an ongoing profile
        });
        await budgetProfileRepository.save(defaultBudgetProfile);
        console.log(`ADV_SEED: Created default BudgetProfile "${defaultBudgetProfile.name}" for ${user.email}`);
      }
      // --- End NEW ---

      // --- 3. (Optional) Create "Custom" Categories for this user (if Category entity supports userId) ---
      // ... (השאר את זה בהערה או מומש אם רלוונטי לך) ...


      const today = new Date();
      // --- 4. Generate Incomes, Single Expenses, and Budgets for Past and Current Months ---
      for (let monthOffset = MONTHS_OF_DATA - 1; monthOffset >= 0; monthOffset--) {
        const currentIterationMonthStart = startOfMonth(subMonths(today, monthOffset));
        const currentIterationMonthEnd = endOfMonth(currentIterationMonthStart);
        const year = currentIterationMonthStart.getFullYear();
        const month = currentIterationMonthStart.getMonth() + 1; // 1-12 for DB
        console.log(`ADV_SEED: Generating Incomes/Expenses/Budgets for ${user.email} for month: ${year}-${month}`);

        // A. Incomes (כמו קודם)
        // ... (קוד יצירת הכנסות) ...
        for (let i = 0; i < getRandomNumber(1, 3, 0); i++) {
          const randomIncomeCategory = getRandomElement(allIncomeCategories);
          const income = incomeRepository.create({ user, userId: user.id, amount: getRandomNumber(3000, 15000), date: format(faker.date.between({ from: currentIterationMonthStart, to: currentIterationMonthEnd }), 'yyyy-MM-dd'), description: `${randomIncomeCategory.name} - ${faker.lorem.words(2)}`, category: randomIncomeCategory, categoryId: randomIncomeCategory.id, });
          await incomeRepository.save(income);
        }


        // B. Single Expenses (כמו קודם)
        // ... (קוד יצירת הוצאות single) ...
        for (let i = 0; i < getRandomNumber(10, 20, 0); i++) {
          const randomExpenseCategory = getRandomElement(allExpenseCategories.filter(c => c.subcategories && c.subcategories.length > 0));
          if (!randomExpenseCategory?.subcategories?.length) continue;
          const randomSubcategory = getRandomElement(randomExpenseCategory.subcategories);
          const expense = expenseRepository.create({ user, userId: user.id, amount: getRandomNumber(20, 500), date: format(faker.date.between({ from: currentIterationMonthStart, to: currentIterationMonthEnd }), 'yyyy-MM-dd'), description: `${randomSubcategory.name} - ${faker.lorem.words(1)}`, subcategory: randomSubcategory, subcategoryId: randomSubcategory.id, expenseType: 'single', isProcessed: true, });
          await expenseRepository.save(expense);
        }

        // --- C. Generate Budgets for Subcategories for this month, linked to the defaultBudgetProfile ---
        const expenseSubcategoriesForBudgeting = allExpenseCategories.flatMap(c => c.subcategories || []).filter(sc => !sc.archived);
        if (expenseSubcategoriesForBudgeting.length > 0 && defaultBudgetProfile) {
          const subcategoriesToBudget = faker.helpers.arrayElements(expenseSubcategoriesForBudgeting, getRandomNumber(3, 7, 0));
          for (const subcat of subcategoriesToBudget) {
            const existingBudget = await budgetRepository.findOneBy({
              budgetProfileId: defaultBudgetProfile.id, // Link to profile
              subcategoryId: subcat.id,
              year: year,
              month: month
            });
            if (!existingBudget) {
              const allocatedAmount = getRandomNumber(100, 800, 0);
              const budgetEntry = budgetRepository.create({
                user, userId: user.id,
                subcategory: subcat, subcategoryId: subcat.id,
                year, month, allocatedAmount,
                budgetProfile: defaultBudgetProfile, // Link to profile
                budgetProfileId: defaultBudgetProfile.id,
              });
              await budgetRepository.save(budgetEntry);
              // console.log(`ADV_SEED: Budget for ${subcat.name} (${year}-${month}): ${allocatedAmount} (Profile: ${defaultBudgetProfile.name})`);
            }
          }
        }
      } // End month loop

      // --- 5. Create Recurring Expense Definitions & Instances ---
      // ... (קוד יצירת הגדרות הוצאה חוזרת ומופעים שלהן - כמו קודם) ...
      // ודא שה-user וה-subcategory המועברים ל-generateRecurringInstances נכונים
      console.log(`ADV_SEED: Creating recurring definitions for ${user.email}`);
      const recurringSamples = [ { freq: 'monthly', interval: 1, desc: 'מנוי חדר כושר', amountRange: [150, 300] }, { freq: 'annually', interval: 1, desc: 'ביטוח רכב', amountRange: [2000, 5000], occurrences: 2 }, ];
      for (const sample of recurringSamples) {
        const randomExpenseCategory = getRandomElement(allExpenseCategories.filter(c => c.subcategories && c.subcategories.length > 0));
        if (!randomExpenseCategory?.subcategories?.length) continue;
        const randomSubcategory = getRandomElement(randomExpenseCategory.subcategories);
        const definition = recurringDefRepository.create({ user, userId: user.id, subcategory: randomSubcategory, subcategoryId: randomSubcategory.id, amount: getRandomNumber(sample.amountRange[0], sample.amountRange[1]), description: sample.desc, frequency: sample.freq as Frequency, interval: sample.interval, startDate: format(subMonths(startOfMonth(today), getRandomNumber(2, MONTHS_OF_DATA-1, 0)), 'yyyy-MM-dd'), occurrences: sample.occurrences, isActive: true, });
        definition.nextDueDate = definition.startDate;
        const savedDef = await recurringDefRepository.save(definition);
        // Generate instances... (logic like before)
        const instances: Partial<Expense>[] = []; let currentDueDate = parseISO(savedDef.startDate); const finalEndDate = savedDef.endDate ? parseISO(savedDef.endDate) : null; let occurrencesCount = 0; const MAX_INSTANCES_REC = 36;
        while (instances.length < MAX_INSTANCES_REC) { if (finalEndDate && currentDueDate > finalEndDate) break; if (savedDef.occurrences && occurrencesCount >= savedDef.occurrences) break; instances.push({ amount: savedDef.amount, date: format(currentDueDate, 'yyyy-MM-dd'), description: savedDef.description, paymentMethod: savedDef.paymentMethod, user: user, userId: user.id, subcategory: randomSubcategory, subcategoryId: randomSubcategory.id, expenseType: 'recurring_instance', parentId: savedDef.id, isProcessed: currentDueDate <= today, }); occurrencesCount++; let nextDate = new Date(currentDueDate); switch (savedDef.frequency) { case 'daily': nextDate.setDate(nextDate.getDate() + savedDef.interval); break; case 'weekly': nextDate.setDate(nextDate.getDate() + (7 * savedDef.interval)); break; default: nextDate = addMonths(nextDate, savedDef.interval); } currentDueDate = nextDate; }
        if (instances.length > 0) { const expenseEntities = expenseRepository.create(instances); await expenseRepository.save(expenseEntities); if(currentDueDate <= (finalEndDate || new Date('2999-12-31')) && (!savedDef.occurrences || occurrencesCount < savedDef.occurrences)) { savedDef.nextDueDate = format(currentDueDate, 'yyyy-MM-dd'); } else { savedDef.nextDueDate = null; savedDef.isActive = false; } await recurringDefRepository.save(savedDef); }
      }


      // --- 6. Create Installment Transactions & Payments ---
      // ... (קוד יצירת עסקאות תשלומים והתשלומים שלהן - כמו קודם) ...
      console.log(`ADV_SEED: Creating installment transactions for ${user.email}`);
      for (let i=0; i< getRandomNumber(1,3,0); i++) {
        const randomExpenseCategory = getRandomElement(allExpenseCategories.filter(c => c.subcategories && c.subcategories.length > 0));
        if (!randomExpenseCategory?.subcategories?.length) continue;
        const randomSubcategory = getRandomElement(randomExpenseCategory.subcategories);
        const totalAmount = getRandomNumber(500, 5000); const numberOfInstallments = getRandomElement([3, 6, 10, 12]); const firstPaymentDate = format(subMonths(startOfMonth(today), getRandomNumber(1, MONTHS_OF_DATA -2, 0)), 'yyyy-MM-dd'); const baseInstallmentAmount = parseFloat((totalAmount / numberOfInstallments).toFixed(2)); const lastPaymentAmount = parseFloat((totalAmount - (baseInstallmentAmount * (numberOfInstallments - 1))).toFixed(2));
        const transaction = installmentRepo.create({ user, userId: user.id, subcategory: randomSubcategory, subcategoryId: randomSubcategory.id, totalAmount, numberOfInstallments, installmentAmount: baseInstallmentAmount, description: `רכישה גדולה - ${faker.commerce.productName()}`, firstPaymentDate, isCompleted: false, });
        const savedTrans = await installmentRepo.save(transaction);
        const payments: Partial<Expense>[] = []; let currentPaymentDate = parseISO(savedTrans.firstPaymentDate);
        for (let j = 0; j < numberOfInstallments; j++) { payments.push({ amount: (j === numberOfInstallments - 1) ? lastPaymentAmount : baseInstallmentAmount, date: format(currentPaymentDate, 'yyyy-MM-dd'), description: `${savedTrans.description} (תשלום ${j+1}/${numberOfInstallments})`, user: user, userId: user.id, subcategory: randomSubcategory, subcategoryId: randomSubcategory.id, expenseType: 'installment_instance', parentId: savedTrans.id, isProcessed: currentPaymentDate <= today, }); if (j < numberOfInstallments - 1) { currentPaymentDate = addMonths(currentPaymentDate, 1); } }
        if (payments.length > 0) { const expenseEntities = expenseRepository.create(payments); await expenseRepository.save(expenseEntities); const allProcessed = payments.every(p => p.isProcessed); if (allProcessed) { savedTrans.isCompleted = true; await installmentRepo.save(savedTrans); } }
      }


    } // End user loop

    console.log('\nADV_SEED: Advanced seeding (with budget profiles and budgets) finished successfully.');

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
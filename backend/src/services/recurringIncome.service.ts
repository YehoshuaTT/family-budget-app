// backend/src/services/recurringIncome.service.ts
// Service functions for recurring income parent-child logic
import { AppDataSource } from '../data-source';
import { Income } from '../entity/Income';
import { RecurringIncomeDefinition } from '../entity/RecurringIncomeDefinition';
import { LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';

/**
 * Update the parent recurring definition after a single child instance is deleted or edited.
 * - Decrement occurrences if set.
 * - Adjust startDate/endDate if needed.
 * - Optionally, deactivate if no more children remain.
 */
export async function updateRecurringDefinitionAfterChildChange({
  parentId,
  userId,
  deletedChildDate,
  action, // 'delete' | 'edit'
}: {
  parentId: number;
  userId: number;
  deletedChildDate: string;
  action: 'delete' | 'edit';
}) {
  const defRepo = AppDataSource.getRepository(RecurringIncomeDefinition);
  const incomeRepo = AppDataSource.getRepository(Income);
  const definition = await defRepo.findOne({ where: { id: parentId, userId, deletedAt: IsNull() } });
  if (!definition) return;

  // Get all non-deleted children
  const children = await incomeRepo.find({
    where: { parentId, userId, deletedAt: IsNull() },
    order: { date: 'ASC' },
  });
  if (children.length === 0) {
    // No more children, deactivate or delete parent
    definition.isActive = false;
    await defRepo.save(definition);
    return;
  }
  // Update occurrences if set
  if (definition.occurrences) {
    definition.occurrences = children.length;
  }
  // Update startDate/endDate to match first/last child
  definition.startDate = children[0].date;
  definition.endDate = children[children.length - 1].date;
  await defRepo.save(definition);
}

/**
 * Bulk delete all children and the parent definition.
 */
export async function deleteAllRecurringInstancesAndParent({ parentId, userId }: { parentId: number; userId: number }) {
  const defRepo = AppDataSource.getRepository(RecurringIncomeDefinition);
  const incomeRepo = AppDataSource.getRepository(Income);
  await incomeRepo.softDelete({ parentId, userId });
  await defRepo.softDelete({ id: parentId, userId });
}

import { z } from 'zod';

import { mn } from '@/i18n/mn';
import { MONEY_PATTERN, requiredNumber } from '@/lib/number-input';
import { CASH_KINDS, PAYMENT_METHODS } from '@/types/models';

const v = mn.validation;

export const cashTransactionSchema = z.object({
  kind: z.enum(CASH_KINDS),
  amount: requiredNumber(MONEY_PATTERN).refine((amount) => amount > 0, v.invalidNumber),
  categoryId: z.string({ error: mn.finance.chooseCategory }).min(1, mn.finance.chooseCategory),
  method: z.enum(PAYMENT_METHODS),
  description: z
    .string()
    .trim()
    .max(500, v.tooLong)
    .transform((value) => value || null),
});

export type CashTransactionFormValues = z.input<typeof cashTransactionSchema>;
export type CashTransactionInput = z.output<typeof cashTransactionSchema>;

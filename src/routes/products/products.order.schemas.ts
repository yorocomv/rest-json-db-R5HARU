import type { CalendarDate } from '@internationalized/date';

import { z } from 'zod';

import {
  viewProductCombinationsRowSchema,
  viewProductComponentsRowSchema,
  viewSkuDetailsRowSchema,
} from './products.dbTable.schemas';

const componentsSchema = z.object({
  components: z
    .array(
      viewProductComponentsRowSchema.pick({
        component_id: true,
        symbol: true,
        amount: true,
        pieces: true,
      })
    )
    .min(1),
});
const combinationsSchema = z.object({
  combinations: z
    .array(
      viewProductCombinationsRowSchema.pick({
        combination_id: true,
        item_product_short_name: true,
        quantity: true,
      })
    )
    .min(1),
});

const schema = viewSkuDetailsRowSchema
  .pick({
    sku_id: true,
    sku_name: true,
    case_quantity: true,
    inner_carton_quantity: true,
    display_category_name: true,
    internal_code: true,
    jan_code: true,
  })
  .extend({
    // フロント側から変更
    order_quantity: z.coerce.number().min(1),
    order_unit: z.enum(['case', 'inner_carton', 'piece']),
    delivery_date: z
      .custom<CalendarDate | null>()
      .refine((val): val is CalendarDate | null => val !== undefined && val !== null, {
        message: '納期を指定してください',
      })
      .transform((val) => {
        const date = new Date(`${val?.year}-${val?.month}-${val?.day}`);
        return date.toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo', dateStyle: 'short' });
      }),
    delivery_time_slot: z.string().pipe(
      z.preprocess(
        (val) => {
          if (typeof val !== 'string') return val;

          return (
            val
              // 全角 => 半角
              .normalize('NFKC')
              .replace(/\D/g, '')
          );
        },
        z
          .string({
            required_error: '時間を指定してください',
            invalid_type_error: '時間を指定してください',
          })
          .min(3, '時間を指定してください')
          .max(4, '時間を指定してください')
      )
    ),
    remark: z.string().max(39).optional(),
    ...componentsSchema.shape,
    combinations: z.literal(false),
  });
const setSchema = schema.extend({
  ...combinationsSchema.shape,
  components: z.literal(false),
});

const productsOrderSchema = z.object({
  products: z
    .array(z.union([schema, setSchema]))
    .min(1)
    .max(7),
});

export default productsOrderSchema;

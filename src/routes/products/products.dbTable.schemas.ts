import { z } from 'zod';
import {
  aCombinationSchema,
  aComponentSchema,
  basicProductsSchema,
  commonProductsSchema,
  productSkusSchema,
  productsSchema,
} from './products.schemas';

export const basicProductsTbRowSchema = commonProductsSchema
  .merge(basicProductsSchema)
  .omit({
    basic_name: true,
  })
  .extend({
    name: z.string().trim().min(1).max(32),
    internal_code: z.string().trim().min(5).max(10).nullable(),
    jan_code: z.string().trim().length(13).regex(/[0-9]/).nullable(),
    expiration_value: z.number().int().positive().nullable(),
    expiration_unit: z.enum(['D', 'M', 'Y']).nullable(),
    predecessor_id: z.number().int().positive().nullable(),
  });

export const productsTbRowSchema = commonProductsSchema
  .merge(productsSchema)
  .omit({ product_name: true })
  .extend({
    name: z.string().trim().min(1).max(32),
    available_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'insert の RETURNING 句で DATE 型を YYYY-MM-DD にキャストして受け取る仕様'),
    discontinued_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'insert の RETURNING 句で DATE 型を YYYY-MM-DD にキャストして受け取る仕様'),
    is_set_product: z.boolean(),
    depth_mm: z.number().int().positive().nullable(),
    width_mm: z.number().int().positive().nullable(),
    diameter_mm: z.number().int().positive().nullable(),
    height_mm: z.number().int().positive().nullable(),
    weight_g: z.number().int().positive().nullable(),
    note: z.string(),
    ulid_str: z.string().ulid(),
  });

export const productComponentsTbRowSchema = commonProductsSchema
  .merge(aComponentSchema)
  .extend({ product_id: z.number().int().positive() });

export const productCombinationsTbRowSchema = commonProductsSchema
  .merge(aCombinationSchema)
  .extend({ product_id: z.number().int().positive() });

export const productSkusTbRowSchema = commonProductsSchema
  .merge(productSkusSchema)
  .omit({ skus_name: true, tags: true })
  .extend({
    name: z.string().trim().min(1).max(32),
    case_quantity: z.number().int().positive().nullable(),
    inner_carton_quantity: z.number().int().positive().nullable(),
    itf_case_code: z.string().trim().length(14).regex(/[0-9]/).nullable(),
    itf_inner_carton_code: z.string().trim().length(14).regex(/[0-9]/).nullable(),
    case_height_mm: z.number().int().positive().nullable(),
    case_width_mm: z.number().int().positive().nullable(),
    case_depth_mm: z.number().int().positive().nullable(),
    case_weight_g: z.number().int().positive().nullable(),
    inner_carton_height_mm: z.number().int().positive().nullable(),
    inner_carton_width_mm: z.number().int().positive().nullable(),
    inner_carton_depth_mm: z.number().int().positive().nullable(),
    inner_carton_weight_g: z.number().int().positive().nullable(),
    ulid_str: z.string().ulid(),
  });

export const productTagsTbRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  label: z.string().trim().min(1).max(32),
  normalized_label: z.string().trim().min(1).max(32),
  created_at: z.date(),
  updated_at: z.date(),
});

export const productSkuTagsTbRowSchema = z.object({
  product_tags_id: z.number().int().positive(),
  product_skus_id: z.number().int().positive(),
  created_at: z.date(),
});

export const viewSingleProductsRowSchema = z.object({
  // Product (単体商品)
  product_id: z.number().int().positive(),
  product_name: z.string().min(1).max(32),
  product_short_name: z.string().min(1).max(32),
  display_category_name: z.string().min(1).max(32),
  available_date: z.date(),
  discontinued_date: z.date(),
  depth_mm: z.number().int().positive().nullable(),
  width_mm: z.number().int().positive().nullable(),
  diameter_mm: z.number().int().positive().nullable(),
  height_mm: z.number().int().positive().nullable(),
  weight_g: z.number().int().positive().nullable(),
  product_note: z.string(),
  ulid_str: z.string().ulid(),
  // Basic Product
  basic_product_name: z.string().min(1).max(32),
  internal_code: z.string().min(5).max(10).nullable(),
  jan_code: z.string().length(13).regex(/[0-9]/).nullable(),
  predecessor_id: z.number().int().positive().nullable(),
  expiration_value: z.number().int().positive().nullable(),
  expiration_unit: z.enum(['D', 'M', 'Y']).nullable(),
  sourcing_type: z.string().min(1).max(32),
  packaging_type: z.string().min(1).max(32),
  // Supplier
  // 半角スペースで連結のため name1.length + name2.length + 1
  supplier_name: z.string().min(1).max(61),
  // First Component (代表成分・内容量)
  component_title: z.string().min(1).max(32),
  component_category_name: z.string().min(1).max(32),
  component_symbol: z.string().min(1).max(8),
  component_amount: z.string().regex(/^\+?(?:[1-9]\d{0,5}|0)(?:\.\d{1,2})?$/),
  component_unit_name: z.string().min(1).max(8),
  component_pieces: z.number().int().positive(),
  component_inner_packaging_type: z.string().min(1).max(32),
});

export const viewSkuDetailsRowSchema = z.object({
  // --- SKU (product_skus) ---
  // 元テーブルで NOT NULL
  sku_id: z.number().int().positive(),
  sku_name: z.string().min(1).max(32),
  sku_ulid_str: z.string().ulid(),
  priority: z.enum(['A', 'B', 'C']),
  updated_at: z.string().datetime(),

  // 元テーブルで NULL 許容
  case_quantity: z.number().int().positive().nullable(),
  inner_carton_quantity: z.number().int().positive().nullable(),

  itf_case_code: z.string().trim().length(14).regex(/[0-9]/).nullable(),
  itf_inner_carton_code: z.string().trim().length(14).regex(/[0-9]/).nullable(),

  case_depth_mm: z.number().int().positive().nullable(),
  case_width_mm: z.number().int().positive().nullable(),
  case_height_mm: z.number().int().positive().nullable(),
  case_weight_g: z.number().int().positive().nullable(),

  inner_carton_depth_mm: z.number().int().positive().nullable(),
  inner_carton_width_mm: z.number().int().positive().nullable(),
  inner_carton_height_mm: z.number().int().positive().nullable(),
  inner_carton_weight_g: z.number().int().positive().nullable(),

  // --- Product (products) ---
  // 元テーブルで NOT NULL
  product_id: z.number().int().positive(),
  product_name: z.string().min(1).max(32),
  product_short_name: z.string().min(1).max(32),
  is_set_product: z.boolean(),
  display_category_name: z.string().min(1).max(32),
  is_assorted: z.boolean(),
  max_piece_weight: z.number().int().positive(),
  max_piece_weight_unit_type_id: z.number().int().positive(),
  available_date: z.date(),
  discontinued_date: z.date(),
  product_note: z.string(),
  ulid_str: z.string().ulid(),

  // 元テーブルで NULL 許容
  depth_mm: z.number().int().positive().nullable(),
  width_mm: z.number().int().positive().nullable(),
  diameter_mm: z.number().int().positive().nullable(),
  height_mm: z.number().int().positive().nullable(),
  weight_g: z.number().int().positive().nullable(),

  // --- Basic Product (basic_products) ---
  // 元テーブルで NOT NULL
  basic_product_id: z.number().int().positive(),
  basic_product_name: z.string().min(1).max(32),
  sourcing_type_id: z.number().int().positive(),
  packaging_type_id: z.number().int().positive(),

  // 元テーブルで NULL 許容
  internal_code: z.string().min(5).max(10).nullable(),
  jan_code: z.string().length(13).regex(/[0-9]/).nullable(),
  expiration_value: z.number().int().positive().nullable(),
  expiration_unit: z.enum(['D', 'M', 'Y']).nullable(),
  predecessor_id: z.number().int().positive().nullable(),

  // --- Joined Tables (Strict Check) ---
  // SQL上は LEFT JOIN ですが、データ不整合（ID=1などのデフォルト値がない状態）を
  // エラーとして検知するため、NOT NULL として定義します。

  // Category
  category_id: z.number().int().positive(),
  category_name: z.string().min(1).max(32),
  category_color: z.enum([
    'rose',
    'pink',
    'fuchsia',
    'purple',
    'violet',
    'indigo',
    'blue',
    'sky',
    'cyan',
    'teal',
    'emerald',
    'green',
    'lime',
    'yellow',
    'amber',
    'orange',
    'red',
    'neutral',
    'stone',
    'zinc',
    'gray',
    'slate',
  ]),
  category_color_shade: z.enum(['200', '300', '400', '500', '600', '700', '800']),

  // Sourcing Type
  sourcing_type: z.string().min(1).max(32),

  // Packaging Type
  packaging_type: z.string().min(1).max(32),

  // Supplier (suppliers テーブルは name2 等に DEFAULT '' があるため NOT NULL)
  supplier_id: z.number().int().positive(),
  supplier_name1: z.string().min(1).max(30),
  supplier_name2: z.string().max(30),
  contact_person_name: z.string().max(32),
  tel: z.string().max(15),
  zip_code: z.string().max(8),
  address1: z.string().max(32),
  address2: z.string().max(32),
  address3: z.string().max(32),
  url: z.string().max(255),
  supplier_note: z.string(),
});

export const viewProductCombinationsRowSchema = z.object({
  product_id: z.number().int().positive(),
  combination_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  set_product_id: z.number().int().positive(),
  set_product_name: z.string().min(1).max(32),
  set_product_short_name: z.string().min(1).max(32),
  item_product_id: z.number().int().positive(),
  item_product_name: z.string().min(1).max(32),
  item_product_short_name: z.string().min(1).max(32),
  created_at: z.date(),
  updated_at: z.date(),
});
export const viewProductCombinationsArraySchema = z.array(viewProductCombinationsRowSchema);

export const viewProductComponentsRowSchema = z.object({
  product_id: z.number().int().positive(),
  product_name: z.string().min(1).max(32),
  product_short_name: z.string().min(1).max(32),
  component_id: z.number().int().positive(),
  title: z.string().min(1).max(32),
  category_id: z.number().int().positive(),
  component_category_name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(8),
  amount: z.string().regex(/^\+?(?:[1-9]\d{0,5}|0)(?:\.\d{1,2})?$/),
  unit_type_id: z.number().int().positive(),
  unit_name: z.string().min(1).max(8),
  pieces: z.number().int().positive(),
  inner_packaging_type_id: z.number().int().positive(),
  inner_packaging_type: z.string().min(1).max(32),
  created_at: z.date(),
  updated_at: z.date(),
});
export const viewProductComponentsArraySchema = z.array(viewProductComponentsRowSchema);

export const viewProductSkusTagCountsRowSchema = z.object({
  tag_id: z.number().int().positive(),
  label: z.string().min(1).max(32),
  tagged_skus_count: z.coerce.number().int().nonnegative(),
  tagged_skus_ids: z.array(z.number().int().positive()).nullable(),
});
export const viewProductSkusTagCountsArraySchema = z.array(viewProductSkusTagCountsRowSchema);

export const viewProductSkuTagsRowSchema = z.object({
  product_skus_id: z.number().int().positive(),
  product_sku_name: z.string().min(1).max(32),
  product_tags_id: z.number().int().positive(),
  label: z.string().min(1).max(32),
  normalized_label: z.string().min(1).max(32),
  created_at: z.date(),
});
export const viewProductSkuTagsArraySchema = z.array(viewProductSkuTagsRowSchema);

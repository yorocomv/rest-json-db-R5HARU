import { insert } from 'sql-bricks';
import { DataBaseError, db, pgp } from '@/db';
import jaconv from 'jaconv';
import UnexpectedError from '@/classes/unexpected-error';
import {
  NewProductSummary,
  PostReqNewProduct,
  PostReqNewSetProduct,
  PostReqUnifiedRevision,
  ProductSkus,
} from './products.types';
import { basicProductsTbRowSchema, productSkusTbRowSchema, productsTbRowSchema } from './products.dbTable.schemas';
import {
  formatBasicProductData,
  formatProductData,
  formatSkusData,
  insertTags,
  resolveRegularProductSpecs,
  resolveSetProductSpecs,
  upsertOne,
} from './products.mo';
import { ProductsOrder } from './products.order.types';

// 完全新規登録（通常商品）
export const registerOneRegularProduct = async (
  body: PostReqNewProduct
): Promise<
  | { isRegistered: true; rows: NewProductSummary }
  | {
      isRegistered: false;
      uniqueConstraintError: {
        key: string;
        value: string;
      };
    }
> =>
  db.tx('regular-product-registration', async (t) => {
    // 1. basic_products
    const basicProductsTbResults = await upsertOne({
      t,
      table: 'basic_products',
      input: formatBasicProductData(body),
      schema: basicProductsTbRowSchema,
      updateId: null,
    });
    if (basicProductsTbResults.isSucceeded === false) {
      return {
        isRegistered: false,
        uniqueConstraintError: {
          key: `${basicProductsTbResults.uniqueConstraintError.table}.${basicProductsTbResults.uniqueConstraintError.column}`,
          value: basicProductsTbResults.uniqueConstraintError.value,
        },
      };
    }

    // 2. products
    const { resolvedCategoryId, resolvedCategoryName, isAssorted, maxPieceWeight, maxPieceWeightUnitTypeId } =
      await resolveRegularProductSpecs(t, body);
    const productsTbResults = await upsertOne({
      t,
      table: 'products',
      input: formatProductData(
        body,
        basicProductsTbResults.rows,
        resolvedCategoryId,
        resolvedCategoryName,
        isAssorted,
        maxPieceWeight,
        maxPieceWeightUnitTypeId,
        'new'
      ),
      schema: productsTbRowSchema,
      returning: '*, available_date::text AS available_date, discontinued_date::text AS discontinued_date',
      updateId: null,
    });
    if (productsTbResults.isSucceeded === false) {
      return {
        isRegistered: false,
        uniqueConstraintError: {
          key: `${productsTbResults.uniqueConstraintError.table}.${productsTbResults.uniqueConstraintError.column}`,
          value: productsTbResults.uniqueConstraintError.value,
        },
      };
    }

    // 3. product_components (並列挿入)
    await Promise.all(
      body.components.map(async (component) => {
        const { text, values } = insert('product_components', {
          product_id: productsTbResults.rows.id,
          title: component.title,
          category_id: component.category_id,
          symbol: jaconv.toHanAscii(component.symbol),
          amount: component.amount,
          unit_type_id: component.unit_type_id,
          pieces: component.pieces,
          inner_packaging_type_id: component.inner_packaging_type_id,
        }).toParams();

        await t.none(text, values).catch((err: string) => {
          throw new DataBaseError(err);
        });
      })
    );

    // 4. product_skus
    const productSkusTbResults = await upsertOne({
      t,
      table: 'product_skus',
      input: formatSkusData(body, productsTbResults.rows, 'new'),
      schema: productSkusTbRowSchema,
      updateId: null,
    });
    if (productSkusTbResults.isSucceeded === false) {
      return {
        isRegistered: false,
        uniqueConstraintError: {
          key: `${productSkusTbResults.uniqueConstraintError.table}.${productSkusTbResults.uniqueConstraintError.column}`,
          value: productSkusTbResults.uniqueConstraintError.value,
        },
      };
    }

    // 5. タグを(無ければ)作成し、紐づけ
    await insertTags(t, body.tags, productSkusTbResults.rows);

    // 6. summary
    return {
      isRegistered: true,
      rows: {
        basic_id: basicProductsTbResults.rows.id,
        product_id: productsTbResults.rows.id,
        sku_id: productSkusTbResults.rows.id,
        product_name: productsTbResults.rows.name,
        short_name: productsTbResults.rows.short_name,
      },
    };
  });

// 完全新規登録（セット商品）
export const registerOneSetProduct = async (
  body: PostReqNewSetProduct
): Promise<
  | { isRegistered: true; rows: NewProductSummary }
  | {
      isRegistered: false;
      uniqueConstraintError: {
        key: string;
        value: string;
      };
    }
> =>
  db.tx('set-product-registration', async (t) => {
    // 1. basic_products
    const basicProductsTbResults = await upsertOne({
      t,
      table: 'basic_products',
      input: formatBasicProductData(body),
      schema: basicProductsTbRowSchema,
      updateId: null,
    });
    if (basicProductsTbResults.isSucceeded === false) {
      return {
        isRegistered: false,
        uniqueConstraintError: {
          key: `${basicProductsTbResults.uniqueConstraintError.table}.${basicProductsTbResults.uniqueConstraintError.column}`,
          value: basicProductsTbResults.uniqueConstraintError.value,
        },
      };
    }

    // 2. products
    const { resolvedCategoryId, resolvedCategoryName, isAssorted, maxPieceWeight, maxPieceWeightUnitTypeId } =
      await resolveSetProductSpecs(t, body);
    const productsTbResults = await upsertOne({
      t,
      table: 'products',
      input: formatProductData(
        body,
        basicProductsTbResults.rows,
        resolvedCategoryId,
        resolvedCategoryName,
        isAssorted,
        maxPieceWeight,
        maxPieceWeightUnitTypeId,
        'new'
      ),
      schema: productsTbRowSchema,
      returning: '*, available_date::text AS available_date, discontinued_date::text AS discontinued_date',
      updateId: null,
    });
    if (productsTbResults.isSucceeded === false) {
      return {
        isRegistered: false,
        uniqueConstraintError: {
          key: `${productsTbResults.uniqueConstraintError.table}.${productsTbResults.uniqueConstraintError.column}`,
          value: productsTbResults.uniqueConstraintError.value,
        },
      };
    }

    // 3. product_combinations (並列挿入)
    await Promise.all(
      body.combinations.map(async (combination) => {
        const { text, values } = insert('product_combinations', {
          product_id: productsTbResults.rows.id,
          item_product_id: combination.item_product_id,
          quantity: combination.quantity,
        }).toParams();

        await t.none(text, values).catch((err: string) => {
          throw new DataBaseError(err);
        });
      })
    );

    // 4. product_skus
    const productSkusTbResults = await upsertOne({
      t,
      table: 'product_skus',
      input: formatSkusData(body, productsTbResults.rows, 'new'),
      schema: productSkusTbRowSchema,
      updateId: null,
    });
    if (productSkusTbResults.isSucceeded === false) {
      return {
        isRegistered: false,
        uniqueConstraintError: {
          key: `${productSkusTbResults.uniqueConstraintError.table}.${productSkusTbResults.uniqueConstraintError.column}`,
          value: productSkusTbResults.uniqueConstraintError.value,
        },
      };
    }

    // 5. タグを(無ければ)作成し、紐づけ
    await insertTags(t, body.tags, productSkusTbResults.rows);

    // 6. summary
    return {
      isRegistered: true,
      rows: {
        basic_id: basicProductsTbResults.rows.id,
        product_id: productsTbResults.rows.id,
        sku_id: productSkusTbResults.rows.id,
        product_name: productsTbResults.rows.name,
        short_name: productsTbResults.rows.short_name,
      },
    };
  });

// JAN 変更なしの仕様変更登録（通常商品 or セット商品）
export const registerOneNewRevisionProduct = async (
  body: PostReqUnifiedRevision
): Promise<
  | { isRegistered: true; rows: NewProductSummary }
  | {
      isRegistered: false;
      uniqueConstraintError: {
        key: string;
        value: string;
      };
    }
> =>
  db.tx('new-revision-product-registration', async (t) => {
    // 0. 通常商品かセット商品かフラグにセット
    const isSet = 'combinations' in body;
    // 1. upsertOne() 再利用のため basic_products テーブルを取得
    const row = await t
      .one<unknown>(
        `SELECT
          id,
          name,
          internal_code,
          jan_code,
          sourcing_type_id,
          packaging_type_id,
          expiration_value,
          expiration_unit,
          predecessor_id,
          created_at,
          updated_at
        FROM basic_products WHERE id = $1`,
        [body.basic_id]
      )
      .catch((err: string) => {
        throw new UnexpectedError(err);
      });
    const basicProductsTbRow = basicProductsTbRowSchema.parse(row);
    // 2. products
    const { resolvedCategoryId, resolvedCategoryName, isAssorted, maxPieceWeight, maxPieceWeightUnitTypeId } = isSet
      ? await resolveSetProductSpecs(t, body)
      : await resolveRegularProductSpecs(t, body);
    const productsTbResults = await upsertOne({
      t,
      table: 'products',
      input: formatProductData(
        body,
        basicProductsTbRow,
        resolvedCategoryId,
        resolvedCategoryName,
        isAssorted,
        maxPieceWeight,
        maxPieceWeightUnitTypeId,
        'new'
      ),
      schema: productsTbRowSchema,
      returning: '*, available_date::text AS available_date, discontinued_date::text AS discontinued_date',
      updateId: null,
    });
    if (productsTbResults.isSucceeded === false) {
      return {
        isRegistered: false,
        uniqueConstraintError: {
          key: `${productsTbResults.uniqueConstraintError.table}.${productsTbResults.uniqueConstraintError.column}`,
          value: productsTbResults.uniqueConstraintError.value,
        },
      };
    }

    if (isSet) {
      // 3.A. product_combinations (並列挿入)
      await Promise.all(
        body.combinations.map(async (combination) => {
          const { text, values } = insert('product_combinations', {
            product_id: productsTbResults.rows.id,
            item_product_id: combination.item_product_id,
            quantity: combination.quantity,
          }).toParams();

          await t.none(text, values).catch((err: string) => {
            throw new DataBaseError(err);
          });
        })
      );
    } else {
      // 3.B. product_components (並列挿入)
      await Promise.all(
        body.components.map(async (component) => {
          const { text, values } = insert('product_components', {
            product_id: productsTbResults.rows.id,
            title: component.title,
            category_id: component.category_id,
            symbol: jaconv.toHanAscii(component.symbol),
            amount: component.amount,
            unit_type_id: component.unit_type_id,
            pieces: component.pieces,
            inner_packaging_type_id: component.inner_packaging_type_id,
          }).toParams();

          await t.none(text, values).catch((err: string) => {
            throw new DataBaseError(err);
          });
        })
      );
    }

    // 4. product_skus
    const productSkusTbResults = await upsertOne({
      t,
      table: 'product_skus',
      input: formatSkusData(body, productsTbResults.rows, 'new'),
      schema: productSkusTbRowSchema,
      updateId: null,
    });
    if (productSkusTbResults.isSucceeded === false) {
      return {
        isRegistered: false,
        uniqueConstraintError: {
          key: `${productSkusTbResults.uniqueConstraintError.table}.${productSkusTbResults.uniqueConstraintError.column}`,
          value: productSkusTbResults.uniqueConstraintError.value,
        },
      };
    }

    // 5. タグを(無ければ)作成し、紐づけ
    await insertTags(t, body.tags, productSkusTbResults.rows);

    // 6. summary
    return {
      isRegistered: true,
      rows: {
        basic_id: body.basic_id,
        product_id: productsTbResults.rows.id,
        sku_id: productSkusTbResults.rows.id,
        product_name: productsTbResults.rows.name,
        short_name: productsTbResults.rows.short_name,
      },
    };
  });

export const registerOneQuantityVariantProduct = async (
  body: ProductSkus
): Promise<
  | { isRegistered: true; rows: NewProductSummary }
  | {
      isRegistered: false;
      uniqueConstraintError: {
        key: string;
        value: string;
      };
    }
> =>
  db.tx('quantity-variant-product-registration', async (t) => {
    // 1. upsertOne() 再利用のため products テーブルを取得
    const row = await t
      .one<unknown>(
        `SELECT
          id,
          basic_id,
          supplier_id,
          name,
          short_name,
          is_set_product,
          cached_category_id,
          display_category_name,
          is_assorted,
          max_piece_weight,
          max_piece_weight_unit_type_id,
          depth_mm,
          width_mm,
          diameter_mm,
          height_mm,
          weight_g,
          available_date::text,
          discontinued_date::text,
          note,
          ulid_str,
          created_at,
          updated_at
        FROM products WHERE id = $1`,
        [body.product_id]
      )
      .catch((err: string) => {
        throw new UnexpectedError(err);
      });
    const productsTbRow = productsTbRowSchema.parse(row);

    // 2. product_skus
    const productSkusTbResults = await upsertOne({
      t,
      table: 'product_skus',
      input: formatSkusData(body, productsTbRow, 'new'),
      schema: productSkusTbRowSchema,
      updateId: null,
    });
    if (productSkusTbResults.isSucceeded === false) {
      return {
        isRegistered: false,
        uniqueConstraintError: {
          key: `${productSkusTbResults.uniqueConstraintError.table}.${productSkusTbResults.uniqueConstraintError.column}`,
          value: productSkusTbResults.uniqueConstraintError.value,
        },
      };
    }

    // 3. タグを(無ければ)作成し、紐づけ
    await insertTags(t, body.tags, productSkusTbResults.rows);

    // 4. summary
    return {
      isRegistered: true,
      rows: {
        basic_id: productsTbRow.basic_id,
        product_id: productsTbRow.id,
        sku_id: productSkusTbResults.rows.id,
        product_name: productsTbRow.name,
        short_name: productsTbRow.short_name,
      },
    };
  });

// 商品発注ＦＡＸの履歴を残す

const currentDate = {
  toPostgres: () => 'CURRENT_DATE',
  rawType: true,
};

const orderHistoryColumnSet = new pgp.helpers.ColumnSet(
  [
    {
      name: 'order_date',
      init: () => currentDate,
    },
    'sku_id',
    'sku_name',
    'case_quantity',
    'inner_carton_quantity',
    'display_category_name',
    'internal_code',
    'jan_code',
    'order_quantity',
    'order_unit',
    'delivery_date',
    'delivery_time_slot',
    {
      name: 'components',
      init: (col) => JSON.stringify(col.value),
    },
    {
      name: 'combinations',
      init: (col) => JSON.stringify(col.value),
    },
    {
      name: 'remark',
      init: (col) => (col.value as string) ?? null,
    },
  ],
  { table: 'product_orders_print_history' }
);

interface InsertedOrderResult {
  registeredAt: string;
  firstSkuName: string | null;
  insertedCount: number;
}

export const registerOneProductsOrder = async (body: ProductsOrder): Promise<InsertedOrderResult> => {
  const result = await db.tx('record-order-history', async (t) => {
    await t
      .proc('create_year_range_partition_by_date', ['product_orders_print_history', currentDate])
      .catch((err: string) => Promise.reject(new DataBaseError(err)));

    if (body.products.length === 0) {
      return {
        registeredAt: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }),
        firstSkuName: null,
        insertedCount: 0,
      };
    }

    const insertQuery = `${pgp.helpers.insert(
      body.products,
      orderHistoryColumnSet
    )} RETURNING registered_at::text, sku_name`;

    const insertedRows = await t.many<{
      registered_at: string;
      sku_name: string;
    }>(insertQuery);

    return {
      registeredAt: insertedRows[0].registered_at,
      firstSkuName: insertedRows[0].sku_name,
      insertedCount: insertedRows.length,
    };
  });
  return result;
};

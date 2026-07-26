import { DataBaseError, db } from '@/db';
import { ulid } from 'ulid';
import { z, ZodType } from 'zod';
import { ITask } from 'pg-promise';
import { insert, update } from 'sql-bricks';
import UnexpectedError from '@/classes/unexpected-error';
import jaconv from 'jaconv';
import {
  ParamsWithProductId,
  ParamsWithProductSkusId,
  PostReqNewProduct,
  PostReqNewSetProduct,
  PostReqProductRevision,
  PostReqSetProductRevision,
  ProductSkus,
  PutReqProduct,
  PutReqSetProduct,
  QueryWithBasicId,
} from './products.types';
import {
  BasicProductsTbRow,
  ProductSkusTbRow,
  ProductsTbRow,
  ViewProductCombinationsArray,
  ViewProductComponentsArray,
  ViewProductSkusTagCountsArray,
  ViewProductSkuTagsArray,
  ViewSingleProductsRow,
  ViewSkuDetailsRow,
} from './products.dbTable.types';
import {
  basicProductsTbRowSchema,
  productsTbRowSchema,
  productTagsTbRowSchema,
  viewProductCombinationsArraySchema,
  viewProductComponentsArraySchema,
  viewProductSkusTagCountsArraySchema,
  viewProductSkuTagsArraySchema,
  viewSingleProductsRowSchema,
  viewSkuDetailsRowSchema,
} from './products.dbTable.schemas';

export const CATEGORY_ID = {
  UNCATEGORIZED: { Int: 1, Str: '未分類' },
  OTHERS: { Int: 2, Str: 'その他' },
} as const;
const WITH_CHOON = /[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g;
// 日本語の長音記号 `ー' は除外
const WITHOUT_CHOON = /[-－﹣−‐⁃‑‒–—﹘―⎯⏤ｰ─━]/g;

const shortNameSanitize = (originalText: string, shouldDash2Space = true) => {
  let text = originalText;

  text = text.trim();
  text = jaconv.toZen(text);
  if (shouldDash2Space) {
    text = text.replace(WITH_CHOON, ' ');
  } else {
    text = text.replace(WITHOUT_CHOON, '-');
  }
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\s*（\s*/g, '（');
  text = text.replace(/\s*）\s*/g, '）');
  text = text.replace(/．/g, '.');

  return text;
};

const normalize = (originalText: string) => {
  let text = originalText;

  text = text.trim();
  text = jaconv.toKatakana(text);
  text = text.replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g, '');
  text = text.replace(/\s+/g, '');
  text = jaconv.normalize(text);

  return text;
};

type Dimension = number | null | undefined;
const sortDimensions = (a: Dimension, b: Dimension): [Dimension, Dimension] => {
  // どちらか一方でも空値（null または undefined）なら、入力順のまま返す
  if (a == null || b == null) {
    return [a, b];
  }

  // 両方とも数値であれば、小さい順に並べ替えて返す
  return a < b ? [a, b] : [b, a];
};

export const formatBasicProductData = (
  body: PostReqNewProduct | PostReqNewSetProduct | PutReqProduct | PutReqSetProduct
) => ({
  name: body.basic_name,
  internal_code: body.internal_code ?? null,
  jan_code: body.jan_code ?? null,
  sourcing_type_id: body.sourcing_type_id,
  packaging_type_id: body.packaging_type_id,
  expiration_value: body.expiration_value ?? null,
  expiration_unit: body.expiration_unit ?? null,
  predecessor_id: body.predecessor_id ?? null,
});

export const formatProductData = (
  body:
    | PostReqNewProduct
    | PostReqNewSetProduct
    | PutReqProduct
    | PutReqSetProduct
    | PostReqProductRevision
    | PostReqSetProductRevision,
  basicProductsTbRow: BasicProductsTbRow,
  category_id: number,
  display_category_name: string,
  is_assorted: boolean,
  max_piece_weight: number,
  max_piece_weight_unit_type_id: number,
  mode: 'new' | 'edit'
) => {
  const [depth, width] = sortDimensions(body.depth_mm, body.width_mm);
  const name = 'product_name' in body ? body.product_name : body.basic_name;

  const productInput = ((o) =>
    // 最後にオブジェクトに戻す
    Object.fromEntries(
      // [key,value] の配列に変換
      Object.entries(o)
        // 値が undefined のものを排除
        .filter(([, v]) => v !== undefined)
    ))({
    basic_id: basicProductsTbRow.id,
    supplier_id: body.supplier_id,
    name,
    short_name: shortNameSanitize(body.short_name),
    is_set_product: body.is_set_product !== '0',
    cached_category_id: category_id,
    display_category_name: is_assorted ? `${display_category_name} 他` : display_category_name,
    is_assorted,
    max_piece_weight,
    max_piece_weight_unit_type_id,
    depth_mm: depth ?? null,
    width_mm: width ?? null,
    diameter_mm: body.diameter_mm ?? null,
    height_mm: body.height_mm ?? null,
    weight_g: body.weight_g ?? null,
    available_date: body.available_date,
    discontinued_date: body.discontinued_date,
    note: body.note ?? undefined,
    ulid_str: mode === 'new' ? ulid() : undefined,
  });
  return productInput;
};

export const formatSkusData = (
  body:
    | PostReqNewProduct
    | PostReqNewSetProduct
    | PutReqProduct
    | PutReqSetProduct
    | PostReqProductRevision
    | PostReqSetProductRevision
    | ProductSkus,
  productsTbRow: ProductsTbRow,
  mode: 'new' | 'edit'
) => {
  let name: string;
  if ('skus_name' in body) {
    name = shortNameSanitize(body.skus_name);
  } else {
    name = shortNameSanitize(body.short_name);
  }
  const [caseDepth, caseWidth] = sortDimensions(body.case_depth_mm, body.case_width_mm);
  const [innerDepth, innerWidth] = sortDimensions(body.inner_carton_depth_mm, body.inner_carton_width_mm);

  const input = ((o) =>
    // 最後にオブジェクトに戻す
    Object.fromEntries(
      // [key,value] の配列に変換
      Object.entries(o)
        // 値が undefined のものを排除
        .filter(([, v]) => v !== undefined)
    ))({
    product_id: productsTbRow.id,
    name,
    case_quantity: body.case_quantity ?? null,
    inner_carton_quantity: body.inner_carton_quantity ?? null,
    itf_case_code: body.itf_case_code ?? null,
    itf_inner_carton_code: body.itf_inner_carton_code ?? null,
    case_depth_mm: caseDepth ?? null,
    case_width_mm: caseWidth ?? null,
    case_height_mm: body.case_height_mm ?? null,
    case_weight_g: body.case_weight_g ?? null,
    inner_carton_depth_mm: innerDepth ?? null,
    inner_carton_width_mm: innerWidth ?? null,
    inner_carton_height_mm: body.inner_carton_height_mm ?? null,
    inner_carton_weight_g: body.inner_carton_weight_g ?? null,
    ulid_str: mode === 'new' ? ulid() : undefined,
    priority: body.priority,
  });
  return input;
};

export async function insertTags(t: ITask<object>, tags: ProductSkus['tags'], productSkusTbRow: ProductSkusTbRow) {
  if (!tags || tags.length === 0) return;

  // まずは重複無し・ノーマライズ済のリストを作成
  interface NormalizedTags {
    label: string;
    normalizedLabel: string;
  }
  const tmpMap = new Map<string, boolean>();
  const normalizedTags = tags.reduce<NormalizedTags[]>((result, tag) => {
    const normalizedLabel = normalize(tag.label);
    if (!tmpMap.has(normalizedLabel)) {
      tmpMap.set(normalizedLabel, true);
      result.push({
        label: shortNameSanitize(tag.label, false),
        normalizedLabel,
      });
    }
    return result;
  }, []);

  // Promise.all で並行処理
  await Promise.all(
    normalizedTags.map(async (normaTag) => {
      try {
        // 1. タグの UPSERT (存在しなければ挿入、存在すれば既存の値を維持して返す)
        // DO UPDATE SET label = product_tags.label とすることで、空打ちアップデートを行い RETURNING で確実に id を取得します。
        const tagRow = await t.one<unknown>(
          `INSERT INTO product_tags (label, normalized_label) 
           VALUES ($1, $2) 
           ON CONFLICT (normalized_label) 
           DO UPDATE SET label = product_tags.label 
           RETURNING *`,
          [normaTag.label, normaTag.normalizedLabel]
        );

        const productTagsRow = productTagsTbRowSchema.parse(tagRow);

        // 2. 中間テーブルへの紐付け INSERT
        // すでに紐付いている場合に備えて ON CONFLICT DO NOTHING を付与するとより安全です
        await t.none(
          `INSERT INTO product_sku_tags (product_tags_id, product_skus_id) 
           VALUES ($1, $2) 
           ON CONFLICT (product_tags_id, product_skus_id) DO NOTHING`,
          [productTagsRow.id, productSkusTbRow.id]
        );
      } catch (err: unknown) {
        if (err instanceof Error) {
          throw new DataBaseError(err.message);
        }
        throw new UnexpectedError(err as string);
      }
    })
  );
}

// ユニーク制約ハンドリングの共通ヘルパー
export async function upsertOne<T>({
  t,
  table,
  input,
  schema,
  returning = '*',
  updateId,
}: {
  t: ITask<object>;
  table: string;
  input: Record<string, unknown>;
  // schema は Zod スキーマであり、バリデーション成功時、型「T」になる
  schema: ZodType<T>;
  returning?: string;
  updateId: number | null;
}): Promise<
  | { isSucceeded: true; rows: T }
  | {
      isSucceeded: false;
      uniqueConstraintError: {
        table: string;
        column: string;
        value: string;
      };
    }
> {
  const { text, values } =
    updateId !== null ? update(table, input).where('id', updateId).toParams() : insert(table, input).toParams();
  console.log(text);

  const keyRegex = /^Key \((.*?)\)=\((.*?)\) already exists\.$/;
  const pgErrorSchema = z.object({
    code: z.string(),
    detail: z
      .string()
      .regex(keyRegex)
      .transform((s) => {
        // 末尾の ! (非null アサーション演算子) でコンパイラに null にならないと伝える
        const [errorMessage, column, value] = s.match(keyRegex)!;
        return { errorMessage, column, value };
      }),
    table: z.string(),
  });
  try {
    const row = await t.one<unknown>(`${text} RETURNING ${returning}`, values);
    return {
      isSucceeded: true,
      rows: schema.parse(row),
    };
  } catch (err: unknown) {
    const parsedError = pgErrorSchema.safeParse(err);
    if (parsedError.success && parsedError.data.code === '23505') {
      console.warn(`⚠️ ${parsedError.data.detail.errorMessage} in ${parsedError.data.table}`);
      return {
        isSucceeded: false,
        uniqueConstraintError: {
          table: parsedError.data.table.toUpperCase(),
          column: parsedError.data.detail.column.toUpperCase(),
          value: parsedError.data.detail.value,
        },
      };
    }
    console.error(`❌ ${table} ${updateId ? 'update' : 'insert'} failed\n`, err);
    throw new DataBaseError(err as string);
  }
}
export const resolveRegularProductSpecs = async (
  t: ITask<object>,
  body: PostReqNewProduct | PutReqProduct | PostReqProductRevision
): Promise<{
  resolvedCategoryId: number;
  resolvedCategoryName: string;
  isAssorted: boolean;
  maxPieceWeight: number;
  maxPieceWeightUnitTypeId: number;
}> => {
  const components = body.components ?? [];

  // reduce の累積値 (accumulator)
  interface Acc {
    // 総内容量の内一番多くを占める内容物の合計（amount * pieces の最大値）
    majorityTotalAmount: number;
    // 上記多数派のカテゴリID
    majorityCategoryId: number;
    // 全体の中で最大の個包装の重さ（単一 piece の amount の最大値）
    maxPieceWeight: number;
    // 上記 maxPieceWeight に対応する単位ID
    maxPieceWeightUnitTypeId: number;
    // カテゴリIDの重複を排除しつつ最初に出現した順序を保持するための Set
    seenCategoryIds: Set<number>;
    // 順序を保持したカテゴリID配列
    orderedCategoryIds: number[];
  }

  const initialAcc: Acc = {
    majorityTotalAmount: 0,
    majorityCategoryId: CATEGORY_ID.UNCATEGORIZED.Int,
    maxPieceWeight: 0,
    maxPieceWeightUnitTypeId: 1,
    seenCategoryIds: new Set<number>(),
    orderedCategoryIds: [],
  };

  // reduce で副作用を一箇所にまとめ、集計ロジックを明確にする
  const stats = components.reduce<Acc>((acc, component) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { amount, pieces, category_id, unit_type_id } = component;
    const totalAmountForComponent = amount * pieces;

    // 「総内容量で最も多い」判定
    if (totalAmountForComponent > acc.majorityTotalAmount) {
      acc.majorityTotalAmount = totalAmountForComponent;
      acc.majorityCategoryId = category_id;
    }

    // 「個包装あたりの重さで最大」判定
    if (amount > acc.maxPieceWeight) {
      acc.maxPieceWeight = amount;
      acc.maxPieceWeightUnitTypeId = unit_type_id;
    }

    // カテゴリID を順序を保って一意に収集
    if (!acc.seenCategoryIds.has(category_id)) {
      acc.seenCategoryIds.add(category_id);
      acc.orderedCategoryIds.push(category_id);
    }

    return acc;
  }, initialAcc);

  const categoryIds = stats.orderedCategoryIds;

  const { name: categoryName } = await t
    .one('SELECT name FROM product_categories WHERE id = $1', [stats.majorityCategoryId])
    .then((row) => z.object({ name: z.string().min(1).max(32) }).parse(row))
    .catch((err: string) => {
      throw new UnexpectedError(err);
    });

  // 特定のID { 1: '未分類', 2: 'その他' } が含まれているかチェック
  const hasUncategorized = categoryIds.includes(CATEGORY_ID.UNCATEGORIZED.Int);
  const hasOthers = categoryIds.includes(CATEGORY_ID.OTHERS.Int);

  /**
   * 優先順位：
   * - 「未分類」が含まれていれば最優先で未分類を返す
   * - 次に「その他」が含まれていればその他を返す
   * - それ以外は多数派のカテゴリを返す
   */
  // eslint-disable-next-line no-nested-ternary
  const resolvedCategoryId = hasUncategorized
    ? CATEGORY_ID.UNCATEGORIZED.Int
    : hasOthers
    ? CATEGORY_ID.OTHERS.Int
    : stats.majorityCategoryId;

  // eslint-disable-next-line no-nested-ternary
  const resolvedCategoryName = hasUncategorized
    ? CATEGORY_ID.UNCATEGORIZED.Str
    : hasOthers
    ? CATEGORY_ID.OTHERS.Str
    : categoryName;

  // 「未分類」や「その他」が含まれる場合は false、それ以外で複数カテゴリなら true
  const isAssorted = !hasUncategorized && !hasOthers && categoryIds.length > 1;

  return {
    resolvedCategoryId,
    resolvedCategoryName,
    isAssorted,
    maxPieceWeight: stats.maxPieceWeight,
    maxPieceWeightUnitTypeId: stats.maxPieceWeightUnitTypeId,
  };
};

export const resolveSetProductSpecs = async (
  t: ITask<object>,
  body: PostReqNewSetProduct | PutReqSetProduct | PostReqSetProductRevision
): Promise<{
  resolvedCategoryId: number;
  resolvedCategoryName: string;
  isAssorted: boolean;
  maxPieceWeight: number;
  maxPieceWeightUnitTypeId: number;
}> => {
  // 組み合わせ内の item_product_id を順序を保って一意に抽出
  const itemIds = [...new Set((body.combinations ?? []).map((item) => item.item_product_id))];

  // 組み合わせが空ならエラー
  if (itemIds.length === 0) {
    throw new UnexpectedError('No item_product_id found in body.combinations');
  }

  const productsTbRowSchemaWithoutReturning = productsTbRowSchema.extend({
    // この２つは insert の RETURNING 句で DATE 型を YYYY-MM-DD にキャストする前提の定義
    // なので、ここでは上書き
    available_date: z.date(),
    discontinued_date: z.date(),
  });
  const itemProducts = await t
    .many('SELECT * FROM products WHERE id IN ($1:csv)', [itemIds])
    .then((rows) => z.array(productsTbRowSchemaWithoutReturning).min(1).parse(rows))
    .catch((err: string) => {
      throw new UnexpectedError(err);
    });

  // reduce の累積値（accumulator）
  interface Acc {
    // 構成商品の中で最大の個包装の重さ
    maxPieceWeight: number;
    // 上記 maxPieceWeight に対応する単位ID
    maxPieceWeightUnitTypeId: number;
    // 上記 maxPieceWeight に対応するカテゴリID（最大個包装のカテゴリ）
    maxPieceWeightCategoryId: number;
    // カテゴリIDの重複を排除しつつ最初に出現した順序を保持するための Set
    seenCategoryIds: Set<number>;
    // 順序を保持したカテゴリID配列（最終的にこれを使う）
    orderedCategoryIds: number[];
    // 各構成商品の is_assorted フラグを順序を保って収集（いずれか true ならアソート扱い）
    orderedAssortedFlags: boolean[];
  }

  const initialAcc: Acc = {
    maxPieceWeight: 0,
    maxPieceWeightUnitTypeId: 1,
    maxPieceWeightCategoryId: CATEGORY_ID.UNCATEGORIZED.Int,
    seenCategoryIds: new Set<number>(),
    orderedCategoryIds: [],
    orderedAssortedFlags: [],
  };

  // productsTbRowSchemaWithoutReturning の型を取り出す
  type ProductRow = z.infer<typeof productsTbRowSchemaWithoutReturning>;

  // id -> product の Map を作る（キャスト不要）
  const productById = new Map<number, ProductRow>();
  for (const p of itemProducts) {
    productById.set(p.id, p);
  }

  // itemIds に対して DB から取得できなかった id を検出して明示的にエラー
  const missingIds = itemIds.filter((id) => !productById.has(id));
  if (missingIds.length > 0) {
    throw new UnexpectedError(`Products not found for ids: ${missingIds.join(',')}`);
  }

  // itemIds の順序で走査して集計（順序を保持したカテゴリ収集のため）
  const stats = itemIds.reduce<Acc>((acc, id) => {
    const item = productById.get(id)!; // ここでは既に存在を保証済みなので非 null アサーション
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { max_piece_weight, max_piece_weight_unit_type_id, cached_category_id, is_assorted } = item;

    // 「個包装あたりの重さで最大」判定
    if (max_piece_weight > acc.maxPieceWeight) {
      acc.maxPieceWeight = max_piece_weight;
      acc.maxPieceWeightUnitTypeId = max_piece_weight_unit_type_id;
      acc.maxPieceWeightCategoryId = cached_category_id;
    }

    // カテゴリID を順序を保って一意に収集
    if (!acc.seenCategoryIds.has(cached_category_id)) {
      acc.seenCategoryIds.add(cached_category_id);
      acc.orderedCategoryIds.push(cached_category_id);
    }

    // アソート真偽値を順序を保って収集
    acc.orderedAssortedFlags.push(Boolean(is_assorted));

    return acc;
  }, initialAcc);

  const categoryIds = stats.orderedCategoryIds;

  const { name: categoryName } = await t
    .one('SELECT name FROM product_categories WHERE id = $1', [stats.maxPieceWeightCategoryId])
    .then((row) => z.object({ name: z.string().min(1).max(32) }).parse(row))
    .catch((err: string) => {
      throw new UnexpectedError(err);
    });

  // 特定のID { 1: '未分類', 2: 'その他' } が含まれているかチェック
  const hasUncategorized = categoryIds.includes(CATEGORY_ID.UNCATEGORIZED.Int);
  const hasOthers = categoryIds.includes(CATEGORY_ID.OTHERS.Int);

  /**
   * 優先順位：
   * - 「未分類」が含まれていれば最優先で未分類を返す
   * - 次に「その他」が含まれていればその他を返す
   * - それ以外は最大個包装のカテゴリを返す
   */
  // eslint-disable-next-line no-nested-ternary
  const resolvedCategoryId = hasUncategorized
    ? CATEGORY_ID.UNCATEGORIZED.Int
    : hasOthers
    ? CATEGORY_ID.OTHERS.Int
    : stats.maxPieceWeightCategoryId;

  // eslint-disable-next-line no-nested-ternary
  const resolvedCategoryName = hasUncategorized
    ? CATEGORY_ID.UNCATEGORIZED.Str
    : hasOthers
    ? CATEGORY_ID.OTHERS.Str
    : categoryName;

  // 「未分類」や「その他」が含まれる場合は false、それ以外で複数カテゴリ or 構成商品のいずれかがアソートなら true
  const isAssorted =
    !hasUncategorized && !hasOthers && (categoryIds.length > 1 || stats.orderedAssortedFlags.includes(true));

  return {
    resolvedCategoryId,
    resolvedCategoryName,
    isAssorted,
    maxPieceWeight: stats.maxPieceWeight,
    maxPieceWeightUnitTypeId: stats.maxPieceWeightUnitTypeId,
  };
};

export const findAllSingleProducts = async (): Promise<ViewSingleProductsRow[]> => {
  const rows = await db
    .manyOrNone('SELECT * FROM v_single_products ORDER BY product_id')
    .catch((err: string) => Promise.reject(new DataBaseError(err)));
  const result = z.array(viewSingleProductsRowSchema).safeParse(rows);

  if (result.success && result.data.length) return result.data;
  if (result.error) throw new DataBaseError(result.error.message);
  return [];
};

export const findAllProductSkuDetails = async (): Promise<ViewSkuDetailsRow[]> => {
  const rows = await db
    .manyOrNone('SELECT * FROM v_sku_details ORDER BY internal_code ASC, basic_product_id ASC')
    .catch((err: string) => Promise.reject(new DataBaseError(err)));
  const result = z.array(viewSkuDetailsRowSchema).safeParse(rows);

  if (result.success && result.data.length) return result.data;
  if (result.error) throw new DataBaseError(result.error.message);
  return [];
};

export const findAllCombinationsAboutProduct = async (
  p: ParamsWithProductId
): Promise<ViewProductCombinationsArray> => {
  const rows = await db
    .manyOrNone('SELECT * FROM v_product_combinations WHERE product_id = $1 ORDER BY combination_id ASC', [p.productId])
    .catch((err: string) => Promise.reject(new DataBaseError(err)));
  const result = viewProductCombinationsArraySchema.safeParse(rows);

  if (result.success && result.data.length) return result.data;
  if (result.error) throw new DataBaseError(result.error.message);
  return [];
};

export const findAllComponentsAboutProduct = async (p: ParamsWithProductId): Promise<ViewProductComponentsArray> => {
  const rows = await db
    .manyOrNone('SELECT * FROM v_product_components WHERE product_id = $1 ORDER BY component_id ASC', [p.productId])
    .catch((err: string) => Promise.reject(new DataBaseError(err)));
  const result = viewProductComponentsArraySchema.safeParse(rows);

  if (result.success && result.data.length) return result.data;
  if (result.error) throw new DataBaseError(result.error.message);
  return [];
};

export const findAllTagsWithProductSkuCount = async (): Promise<ViewProductSkusTagCountsArray> => {
  const rows = await db
    .manyOrNone('SELECT * FROM v_product_skus_tag_counts ORDER BY tagged_skus_count DESC')
    .catch((err: unknown) => {
      if (err instanceof Error) throw new DataBaseError(err.message);
      throw new UnexpectedError(err as string);
    });
  const result = viewProductSkusTagCountsArraySchema.safeParse(rows);

  if (result.success && result.data.length) return result.data;
  if (result.error) throw new UnexpectedError(result.error.message);
  return [];
};

// 特定の SKU に付いているタグを取得
export const findAllTagsAboutProductSku = async (p: ParamsWithProductSkusId): Promise<ViewProductSkuTagsArray> => {
  const rows = await db
    .manyOrNone('SELECT * FROM v_product_sku_tags WHERE product_skus_id = $1 ORDER BY product_tags_id ASC', [
      p.productSkusId,
    ])
    .catch((err: unknown) => {
      if (err instanceof Error) throw new DataBaseError(err.message);
      throw new UnexpectedError(err as string);
    });
  const result = viewProductSkuTagsArraySchema.safeParse(rows);

  if (result.success && result.data.length) return result.data;
  if (result.error) throw new UnexpectedError(result.error.message);
  return [];
};

// excludeId は編集時に先代商品（リニューアル前）に自分自身を指定できたらマズイので指定する
export const findAllBasicProducts = async (q: QueryWithBasicId): Promise<BasicProductsTbRow[]> => {
  const hasExcludeId = q.excludeId !== undefined;

  const query = hasExcludeId
    ? 'SELECT * FROM basic_products WHERE id != $1 ORDER BY id'
    : 'SELECT * FROM basic_products ORDER BY id';
  const params = hasExcludeId ? [q.excludeId] : undefined;

  const rows = await db.manyOrNone(query, params).catch((err: string) => Promise.reject(new DataBaseError(err)));
  const result = z.array(basicProductsTbRowSchema).safeParse(rows);

  if (result.success && result.data.length) return result.data;
  if (result.error) throw new DataBaseError(result.error.message);
  return [];
};

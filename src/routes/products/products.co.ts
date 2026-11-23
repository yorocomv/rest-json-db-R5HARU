import { NextFunction, Request, Response } from 'express';
import {
  ParamsWithProductId,
  ParamsWithProductSkusId,
  PostReqNewProduct,
  PostReqNewSetProduct,
  PostReqUnifiedRevision,
  ProductSkus,
  PutReqProduct,
  PutReqSetProduct,
  QueryWithBasicId,
} from './products.types';
import {
  findAllBasicProducts,
  findAllCombinationsAboutProduct,
  findAllComponentsAboutProduct,
  findAllProductSkuDetails,
  findAllSingleProducts,
  findAllTagsAboutProductSku,
  findAllTagsWithProductSkuCount,
} from './products.mo';
import {
  registerOneNewRevisionProduct,
  registerOneProductsOrder,
  registerOneQuantityVariantProduct,
  registerOneRegularProduct,
  registerOneSetProduct,
} from './products.mo.inserts';
import { updateOneRegularProduct, updateOneSetProduct } from './products.mo.updates';
import { ProductsOrder } from './products.order.types';

export const registerOneRegular = async (
  req: Request<object, object, PostReqNewProduct>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const productSummary = await registerOneRegularProduct(req.body);
    if (productSummary.isRegistered === false) {
      res.status(200).json(productSummary);
    } else {
      res.status(201).json(productSummary);
    }
  } catch (err: unknown) {
    res.status(500);
    next(err);
  }
};

export const updateOneRegular = async (
  req: Request<object, object, PutReqProduct>,
  res: Response,
  next: NextFunction
) => {
  try {
    const productSummary = await updateOneRegularProduct(req.body);
    // productSummary.isUpdated の真偽にかかわらず
    // ステータスコード 200
    res.status(200).json(productSummary);
  } catch (err: unknown) {
    res.status(500);
    next(err);
  }
};

export const registerOneSetItem = async (
  req: Request<object, object, PostReqNewSetProduct>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const productSummary = await registerOneSetProduct(req.body);
    if (productSummary.isRegistered === false) {
      res.status(200).json(productSummary);
    } else {
      res.status(201).json(productSummary);
    }
  } catch (err: unknown) {
    res.status(500);
    next(err);
  }
};

export const updateOneSetItem = async (
  req: Request<object, object, PutReqSetProduct>,
  res: Response,
  next: NextFunction
) => {
  try {
    const productSummary = await updateOneSetProduct(req.body);
    // productSummary.isUpdated の真偽にかかわらず
    // ステータスコード 200
    res.status(200).json(productSummary);
  } catch (err: unknown) {
    res.status(500);
    next(err);
  }
};

export const registerOneNewRevision = async (
  req: Request<object, object, PostReqUnifiedRevision>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const revisionSummary = await registerOneNewRevisionProduct(req.body);
    if (revisionSummary.isRegistered === false) {
      res.status(200).json(revisionSummary);
    } else {
      res.status(201).json(revisionSummary);
    }
  } catch (err: unknown) {
    res.status(500);
    next(err);
  }
};

export const registerOneQuantityVariant = async (
  req: Request<object, object, ProductSkus>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const variantSkuSummary = await registerOneQuantityVariantProduct(req.body);
    if (variantSkuSummary.isRegistered === false) {
      res.status(200).json(variantSkuSummary);
    } else {
      res.status(201).json(variantSkuSummary);
    }
  } catch (err: unknown) {
    res.status(500);
    next(err);
  }
};

export const findAllSingles = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const singleProducts = await findAllSingleProducts();
    res.status(200).json(singleProducts);
  } catch (err: unknown) {
    console.error(err);
    res.status(500);
    next(err);
  }
};

export const findAllSkuDetails = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const skuDetails = await findAllProductSkuDetails();
    res.status(200).json(skuDetails);
  } catch (err: unknown) {
    console.error(err);
    res.status(500);
    next(err);
  }
};

export const findAllCombinationsAbout = async (
  req: Request<ParamsWithProductId>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const combinations = await findAllCombinationsAboutProduct(req.params);
    res.status(200).json(combinations);
  } catch (err: unknown) {
    console.error(err);
    res.status(500);
    next(err);
  }
};

export const findAllComponentsAbout = async (
  req: Request<ParamsWithProductId>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const components = await findAllComponentsAboutProduct(req.params);
    res.status(200).json(components);
  } catch (err: unknown) {
    console.error(err);
    res.status(500);
    next(err);
  }
};

export const findAllTagsWithSkuCount = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tags = await findAllTagsWithProductSkuCount();
    res.status(200).json(tags);
  } catch (err: unknown) {
    console.error(err);
    res.status(500);
    next(err);
  }
};

export const findAllTagsAboutSku = async (
  req: Request<ParamsWithProductSkusId>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tags = await findAllTagsAboutProductSku(req.params);
    res.status(200).json(tags);
  } catch (err: unknown) {
    console.error(err);
    res.status(500);
    next(err);
  }
};

export const findAllBasic = async (
  req: Request<object, object, object, QueryWithBasicId>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const basicProducts = await findAllBasicProducts(req.query);
    res.status(200).json(basicProducts);
  } catch (err: unknown) {
    console.error(err);
    res.status(500);
    next(err);
  }
};

export const registerOneOrder = async (
  req: Request<object, object, ProductsOrder>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { registeredAt, firstSkuName, insertedCount } = await registerOneProductsOrder(req.body);
    if (insertedCount > 0) {
      res.status(201).json({
        isSuccess: true,
        message: `${registeredAt}: ${firstSkuName} ${
          insertedCount === 1
            ? 'の注文を登録しました'
            : `他、計${new Intl.NumberFormat('ja-JP-u-nu-fullwide').format(insertedCount)}の注文を登録しました`
        }`,
      });
    } else {
      res.status(500).json({
        isSuccess: true,
        message: `💥👻💥${registeredAt}: 注文の登録に失敗しました`,
      });
    }
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({
      isSuccess: false,
      message: `💥⁉️💥${new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' })}: 注文の登録に失敗しました`,
    });
    next(err);
  }
};

import { RequestHandler, Router } from 'express';
import { validateRequest } from '../../middleWares';
import * as controllers from './products.co';
import {
  paramsWithProductIdSchema,
  paramsWithProductSkusIdSchema,
  postReqNewProductSchema,
  postReqNewSetProductSchema,
  postReqUnifiedRevisionSchema,
  productSkusSchema,
  putReqProductSchema,
  putReqSetProductSchema,
  queryWithBasicIdSchema,
} from './products.schemas';

import findAll, { findAllPackagingTypeFlags } from './options/options.co';
import allImages from './images/images.co';
import productsOrderSchema from './products.order.schemas';

const router = Router();

router
  .route('/')
  .get(controllers.findAllSkuDetails as RequestHandler)
  .post(
    validateRequest({ body: postReqNewProductSchema }) as RequestHandler,
    controllers.registerOneRegular as RequestHandler
  )
  .put(
    validateRequest({ body: putReqProductSchema }) as RequestHandler,
    controllers.updateOneRegular as RequestHandler
  );
router
  .route('/set-item')
  .post(
    validateRequest({ body: postReqNewSetProductSchema }) as RequestHandler,
    controllers.registerOneSetItem as RequestHandler
  )
  .put(
    validateRequest({ body: putReqSetProductSchema }) as RequestHandler,
    controllers.updateOneSetItem as RequestHandler
  );
router
  .route('/revision')
  .post(
    validateRequest({ body: postReqUnifiedRevisionSchema }) as RequestHandler,
    controllers.registerOneNewRevision as RequestHandler
  );
router
  .route('/sku/:productSkusId/tags')
  .get(
    validateRequest({ params: paramsWithProductSkusIdSchema }) as RequestHandler,
    controllers.findAllTagsAboutSku as unknown as RequestHandler
  );
router.route('/sku/tags').get(controllers.findAllTagsWithSkuCount as RequestHandler);
router
  .route('/sku')
  .post(
    validateRequest({ body: productSkusSchema }) as RequestHandler,
    controllers.registerOneQuantityVariant as RequestHandler
  );
router.route('/single-products').get(controllers.findAllSingles as RequestHandler);
router
  .route('/basic-products')
  .get(
    validateRequest({ query: queryWithBasicIdSchema }) as RequestHandler,
    controllers.findAllBasic as unknown as RequestHandler
  );

router
  .route('/:productId/combinations')
  .get(
    validateRequest({ params: paramsWithProductIdSchema }) as RequestHandler,
    controllers.findAllCombinationsAbout as unknown as RequestHandler
  );

router
  .route('/:productId/components')
  .get(
    validateRequest({ params: paramsWithProductIdSchema }) as RequestHandler,
    controllers.findAllComponentsAbout as unknown as RequestHandler
  );

router
  .route('/order')
  .post(
    validateRequest({ body: productsOrderSchema }) as RequestHandler,
    controllers.registerOneOrder as RequestHandler
  );

// パッケージタイプや発注先などの各セレクト・オプションを一括返却
router.route('/options').get(findAll as RequestHandler);
router.route('/packaging-type-flags').get(findAllPackagingTypeFlags as RequestHandler);
router.route('/images').get(allImages as RequestHandler);

export default router;

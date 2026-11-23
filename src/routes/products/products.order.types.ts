import { z } from 'zod';
import productsOrderSchema from './products.order.schemas';

export type ProductsOrder = z.infer<typeof productsOrderSchema>;

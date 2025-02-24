import { DataBaseError, db } from '@/db';
import { insert } from 'sql-bricks';
import { IResult } from 'pg-promise/typescript/pg-subset';
import {
  FindShippingInstructionsQuery,
  ShippingInstructionPrintHistoryID,
  ShippingInstructionPrintHistoryIDWithoutBrand,
  ShippingInstructionPrintHistoryInput,
  ShippingInstructionPrintHistoryTbRow,
} from './shippingInstructionPrintouts.types';

export const findSomeShippingInstructions = async ({
  category,
  dateA,
  dateB,
}: FindShippingInstructionsQuery): Promise<ShippingInstructionPrintHistoryTbRow[] | []> => {
  const nextDayString = (date: Date): string => {
    // 元の Date オブジェクトを変更しないようにコピーを作成
    const newDate = new Date(date);
    // setDate() を使用して日数を加算
    newDate.setDate(newDate.getDate() + 1);
    const newDateString = newDate.toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo', dateStyle: 'short' });
    return newDateString;
  };

  let startDate: Date | undefined;
  let endDate: Date | undefined;
  // AB 同じ もしくは両方 undefined
  if (dateA === dateB) {
    if (dateA === undefined) {
      startDate = new Date();
    } else {
      startDate = dateA;
    }
    endDate = undefined;
    // AB 有効な Date 型
  } else if (dateA !== undefined && dateB !== undefined) {
    if (dateA < dateB) {
      startDate = dateA;
      endDate = dateB;
    } else {
      startDate = dateB;
      endDate = dateA;
    }
    // ここにエラー処理をねじ込む!!
    // 検索範囲を制限して、それを超えたらエラーを返す
    const millisecondsIn7Days = 7 * 24 * 60 * 60 * 1000;
    if (endDate.getTime() - startDate.getTime() > millisecondsIn7Days) {
      throw new DataBaseError('❎️🔍 - 検索範囲の指定は７日間までです', 400);
    }
    // 片方有効な Date 型、もう片方 undefined
  } else {
    startDate = dateA ?? dateB;
    endDate = undefined;
  }
  const startDateStr = startDate?.toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo', dateStyle: 'short' });
  // コンパイラを非nullアサーション演算子で懐柔💦
  const dayAfterEndDateStr = endDate === undefined ? nextDayString(startDate!) : nextDayString(endDate);

  // ::text キャストを使いたいので地道にカラムを列挙
  const columns =
    'delivery_date::text, delivery_time_str, printed_at::text, page_num_str, customer_name, customer_address, wholesaler, order_number, shipping_date::text, carrier, package_count, items_of_order';

  // 印刷日時（これだけ DB ではタイムスタンプをデートと比較）で検索
  if (category === 'printed_at') {
    const result: ShippingInstructionPrintHistoryTbRow[] = await db
      .manyOrNone(
        `SELECT ${columns} FROM shipping_instruction_print_history WHERE printed_at >= $1 AND printed_at < $2 ORDER BY printed_at`,
        [startDateStr, dayAfterEndDateStr]
      )
      .catch((err: string) => Promise.reject(new DataBaseError(err)));
    return result;
  }
  // 配達指定日 or 出荷予定日で検索
  if (endDate === undefined) {
    const result: ShippingInstructionPrintHistoryTbRow[] = await db
      .manyOrNone(
        `SELECT ${columns} FROM shipping_instruction_print_history WHERE ${category} = $1 ORDER BY ${category}`,
        [startDateStr]
      )
      .catch((err: string) => Promise.reject(new DataBaseError(err)));
    return result;
  }
  const result: ShippingInstructionPrintHistoryTbRow[] = await db
    .manyOrNone(
      `SELECT ${columns} FROM shipping_instruction_print_history WHERE ${category} >= $1 AND ${category} < $2 ORDER BY ${category}`,
      [startDateStr, dayAfterEndDateStr]
    )
    .catch((err: string) => Promise.reject(new DataBaseError(err)));
  return result;
};

export const createOneShippingInstructionPrintout = async (
  body: ShippingInstructionPrintHistoryInput
): Promise<ShippingInstructionPrintHistoryIDWithoutBrand | string> => {
  if (
    body.delivery_date === '' ||
    body.customer_name === '' ||
    body.customer_address === '' ||
    body.items_of_order === ''
  ) {
    return '🖊️必要項目が不足しています😓💦';
  }
  const returnID = await db.tx('recording-the-printout-of-shipping-instructions', async (t) => {
    await t
      .proc('create_year_range_partition_by_date', ['shipping_instruction_print_history', body.delivery_date])
      .catch((err: string) => Promise.reject(new DataBaseError(err)));

    let record: ShippingInstructionPrintHistoryInput = { ...body };
    if (body.shipping_date === '') {
      // 即時関数の分割代入引数で shipping_date を捨てる🗑️
      record = (({ shipping_date, ..._rest }) => _rest)(record);
    }
    if (body.package_count === 0) {
      // 即時関数の分割代入引数で package_count を捨てる🗑️
      record = (({ package_count, ..._rest }) => _rest)(record);
    }

    const { text, values } = insert('shipping_instruction_print_history', record).toParams();
    // 👇️RETURNING 句で ::text キャスト演算子を使用
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const id: ShippingInstructionPrintHistoryIDWithoutBrand = await t
      .one(`${text} RETURNING delivery_date::text, printed_at::text`, values)
      .catch((err: string) => Promise.reject(new DataBaseError(err)));
    return id;
  });
  return returnID;
};

export const deleteOneHistory = async ({
  delivery_date,
  printed_at,
}: ShippingInstructionPrintHistoryID): Promise<{ command: string; rowCount: number }> => {
  const result: { command: string; rowCount: number } = await db
    .result(
      'DELETE FROM shipping_instruction_print_history WHERE delivery_date = $1 AND printed_at = $2',
      [delivery_date, printed_at],
      (r: IResult) => ({
        command: r.command,
        rowCount: r.rowCount,
      })
    )
    .catch((err: string) => Promise.reject(new DataBaseError(err)));
  return result;
};

-- シフトJIS CRLF で保存してコマンドプロンプトで実行
-- psql> \i <FULL_PATH(unix like)>.sql
/* == 事前処理 ==
- 旧バージョンの定義をクリーンアップ */
DROP VIEW IF EXISTS v_sku_details;

DROP VIEW IF EXISTS v_product_combinations;

DROP VIEW IF EXISTS v_product_components;

DROP VIEW IF EXISTS v_product_sku_tags;

DROP VIEW IF EXISTS v_product_skus_tag_counts;

DROP VIEW IF EXISTS v_single_products;

--- 製品詳細ビュー
CREATE OR REPLACE VIEW v_sku_details AS
SELECT
    -- SKU
    ps.id AS sku_id,
    ps.name AS sku_name,
    ps.ulid_str AS sku_ulid_str,
    ps.priority,
    ps.case_quantity,
    ps.inner_carton_quantity,
    ps.itf_case_code,
    ps.itf_inner_carton_code,
    ps.case_depth_mm,
    ps.case_width_mm,
    ps.case_height_mm,
    ps.case_weight_g,
    ps.inner_carton_depth_mm,
    ps.inner_carton_width_mm,
    ps.inner_carton_height_mm,
    ps.inner_carton_weight_g,
    ps.updated_at,
    -- Product
    p.id AS product_id,
    p.name AS product_name,
    p.short_name AS product_short_name,
    p.is_set_product,
    p.display_category_name,
    p.is_assorted,
    p.max_piece_weight,
    p.max_piece_weight_unit_type_id,
    p.depth_mm,
    p.width_mm,
    p.diameter_mm,
    p.height_mm,
    p.weight_g,
    p.available_date,
    p.discontinued_date,
    p.ulid_str,
    p.note AS product_note,
    -- Basic Product
    bp.id AS basic_product_id,
    bp.name AS basic_product_name,
    bp.internal_code,
    bp.jan_code,
    bp.sourcing_type_id,
    bp.packaging_type_id,
    bp.expiration_value,
    bp.expiration_unit,
    bp.predecessor_id,
    -- Product category
    pc.id AS category_id,
    pc.name AS category_name,
    pc.cat_color AS category_color,
    pc.color_shade AS category_color_shade,
    pst.name AS sourcing_type,
    ppt.name AS packaging_type,
    -- Supplier
    s.id AS supplier_id,
    s.name1 AS supplier_name1,
    s.name2 AS supplier_name2,
    s.contact_person_name,
    s.tel,
    s.zip_code,
    s.address1,
    s.address2,
    s.address3,
    s.url,
    s.note AS supplier_note
FROM
    product_skus ps
    JOIN products p ON ps.product_id = p.id
    JOIN basic_products bp ON p.basic_id = bp.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN product_sourcing_types pst ON bp.sourcing_type_id = pst.id
    JOIN product_categories pc ON p.cached_category_id = pc.id
    LEFT JOIN product_packaging_types ppt ON bp.packaging_type_id = ppt.id;

--- セット品構成ビュー
CREATE OR REPLACE VIEW v_product_combinations AS
SELECT
    p.id AS product_id,
    pcmb.id AS combination_id,
    pcmb.quantity,
    -- Set Product (完成商品)
    p.id AS set_product_id,
    p.name AS set_product_name,
    p.short_name AS set_product_short_name,
    -- Item Product (内訳商品)
    pcmb.item_product_id,
    item_p.name AS item_product_name,
    item_p.short_name AS item_product_short_name,
    pcmb.created_at,
    pcmb.updated_at
FROM
    products p
    JOIN product_combinations pcmb ON p.id = pcmb.product_id
    JOIN products item_p ON pcmb.item_product_id = item_p.id;

--- 製品成分ビュー
CREATE OR REPLACE VIEW v_product_components AS
SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.short_name AS product_short_name,
    -- Component
    pcmp.id AS component_id,
    pcmp.title,
    pcmp.category_id,
    pc.name AS component_category_name,
    pcmp.symbol,
    pcmp.amount,
    pcmp.unit_type_id,
    ut.name AS unit_name,
    pcmp.pieces,
    pcmp.inner_packaging_type_id,
    ipt.name AS inner_packaging_type,
    pcmp.created_at,
    pcmp.updated_at
FROM
    products p
    JOIN product_components pcmp ON p.id = pcmp.product_id
    JOIN product_categories pc ON pcmp.category_id = pc.id
    LEFT JOIN unit_types ut ON pcmp.unit_type_id = ut.id
    LEFT JOIN product_inner_packaging_types ipt ON pcmp.inner_packaging_type_id = ipt.id;

-- 製品 SKU タグビュー
CREATE OR REPLACE VIEW v_product_sku_tags AS
SELECT
    pst.product_skus_id,
    ps.name AS product_sku_name,
    pst.product_tags_id,
    pt.label,
    pt.normalized_label,
    pst.created_at
FROM
    product_tags pt
    JOIN product_sku_tags pst ON pt.id = pst.product_tags_id
    JOIN product_skus ps ON pst.product_skus_id = ps.id;

-- 各タグに、どの SKU が幾つ紐付けられているか
CREATE OR REPLACE VIEW v_product_skus_tag_counts AS
SELECT
    pt.id AS tag_id,
    pt.label,
    COUNT(ps.id) AS tagged_skus_count,
    -- 商品がない場合は NULL にするため FILTER を追加
    ARRAY_AGG(ps.id) FILTER (
        WHERE
            ps.id IS NOT NULL
    ) AS tagged_skus_ids
FROM
    product_tags pt
    LEFT JOIN product_sku_tags pst ON pt.id = pst.product_tags_id
    LEFT JOIN product_skus ps ON pst.product_skus_id = ps.id
GROUP BY
    pt.id,
    pt.label;

-- セット品や SKU を作る時のアイテム候補一覧ビュー
CREATE OR REPLACE VIEW v_single_products AS
SELECT
    -- Product (単体商品)
    p.id AS product_id,
    p.name AS product_name,
    p.short_name AS product_short_name,
    p.display_category_name,
    p.available_date,
    p.discontinued_date,
    p.depth_mm,
    p.width_mm,
    p.diameter_mm,
    p.height_mm,
    p.weight_g,
    p.note AS product_note,
    p.ulid_str,
    -- Basic Product
    bp.name AS basic_product_name,
    bp.internal_code,
    bp.jan_code,
    bp.predecessor_id,
    bp.expiration_value,
    bp.expiration_unit,
    pst.name AS sourcing_type,
    ppt.name AS packaging_type,
    -- Supplier
    -- name2 は NOT NULL DEFAULT '' のため、空文字のときに余分な末尾スペースが残らないように RTRIM を使用
    RTRIM(s.name1 || ' ' || s.name2) AS supplier_name,
    -- First Component (代表成分・内容量)
    pcmp.title AS component_title,
    pc.name AS component_category_name,
    pcmp.symbol AS component_symbol,
    pcmp.amount AS component_amount,
    ut.name AS component_unit_name,
    pcmp.pieces AS component_pieces,
    ipt.name AS component_inner_packaging_type
FROM
    products p
    JOIN basic_products bp ON p.basic_id = bp.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN product_sourcing_types pst ON bp.sourcing_type_id = pst.id
    LEFT JOIN product_packaging_types ppt ON bp.packaging_type_id = ppt.id
    -- LATERAL JOIN: 各製品(p)に紐づく最初の1件の成分(pcmp)を取得
    -- LATERAL は外側の行 (p) を参照できるため、サブクエリ内で p.id を使って該当成分を絞る
    LEFT JOIN LATERAL (
        SELECT
            pcmp.title,
            pcmp.category_id,
            pcmp.symbol,
            pcmp.amount,
            pcmp.unit_type_id,
            pcmp.pieces,
            pcmp.inner_packaging_type_id
        FROM
            product_components pcmp
        WHERE
            -- サブクエリ内で外側の p.id を参照している（該当行が無ければサブクエリは空になる）
            pcmp.product_id = p.id
        ORDER BY
            pcmp.id ASC
        LIMIT
            1
            -- サブクエリが空の場合、LEFT JOIN LATERAL により pcmp.* は NULL になる
    ) pcmp ON TRUE
    LEFT JOIN product_categories pc ON pcmp.category_id = pc.id
    LEFT JOIN unit_types ut ON pcmp.unit_type_id = ut.id
    LEFT JOIN product_inner_packaging_types ipt ON pcmp.inner_packaging_type_id = ipt.id
WHERE
    p.is_set_product = false;
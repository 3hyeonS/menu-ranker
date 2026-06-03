CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS menu_vector_index (
  menu_id integer PRIMARY KEY,
  owner_user_id integer NULL,
  data_source smallint NOT NULL,
  is_deleted smallint NOT NULL DEFAULT 0,
  name text NOT NULL,
  brand text NULL,
  category text NULL,
  search_text text NOT NULL,
  visual_text text NULL,
  calories real NULL,
  carbs real NULL,
  protein real NULL,
  fat real NULL,
  sugars real NULL,
  sodium real NULL,
  text_embedding vector(768) NOT NULL,
  image_embedding vector(768) NULL,
  source_updated_at timestamptz NULL,
  embedded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_vector_text_embedding
ON menu_vector_index
USING hnsw (text_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_menu_vector_image_embedding
ON menu_vector_index
USING hnsw (image_embedding vector_cosine_ops)
WHERE image_embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_vector_owner_deleted
ON menu_vector_index (owner_user_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_menu_vector_brand
ON menu_vector_index (brand)
WHERE brand IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_vector_category
ON menu_vector_index (category)
WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_vector_data_source
ON menu_vector_index (data_source);

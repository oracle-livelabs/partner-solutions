/*
|| SQL:     create-hnsw-vector-index.sql
|| Purpose: Creates a Hierarchical Navigable Small-World (HNSW) vector index on 
||          embedded VECTOR column contents
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

-----
-- Specific parameters include:
-- NEIGHBORS:      Total number of connections permitted per vector
-- EFCONSTRUCTION: Maximum number of closest vector candidates considered at 
--                 each step of the search during construction
-----

DROP INDEX IF EXISTS corpus_chunks_ivf_idx;
DROP INDEX IF EXISTS corpus_chunks_hnsw_idx;

CREATE VECTOR INDEX corpus_chunks_hnsw_idx
  ON corpus_chunks (cdc_embedded)
  ORGANIZATION INMEMORY NEIGHBOR GRAPH
  DISTANCE COSINE
  WITH TARGET ACCURACY 95
  PARAMETERS (
    TYPE HNSW
   ,NEIGHBORS 2
   ,EFCONSTRUCTION 5
);

/*
|| SQL:     create_vector_indexes.sql
|| Purpose: Creates different styles of vector indexes on vectorized content
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

-----
-- STATUS: ++ FAILS ++ with ORA-51961: The vector memory area is out of space
-- Create a Hierarchical Navigable Small-World (HNSW) vector index on embedded VECTOR column contents.
-- Specific parameters include:
-- NEIGHBORS: The total ...
-- EFCONSTRUCTION: How many ...
-----

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

-----
-- STATUS: ++ WORKS ++ with low number of partitions (2)
-- Create an Inverted File-Flat (IVF) vector index on embedded VECTOR column contents.
-- Specific parameters include:
-- NEIGHBOR PARTITIONS: The ...
-- SAMPLE_PER_PARTITION: The ...
-- MIN_VECTORS_PER_PARTITION: The ...
-----

DROP INDEX IF EXISTS corpus_chunks_ivf_idx;

CREATE VECTOR INDEX corpus_chunks_ivf_idx 
  ON corpus_chunks (cdc_embedded)
  ORGANIZATION NEIGHBOR PARTITIONS
  DISTANCE COSINE
  WITH TARGET ACCURACY 95
  PARAMETERS (
    TYPE IVF
   ,NEIGHBOR PARTITIONS 10 
--   ,SAMPLE_PER_PARTITION 2 -- Bad value????
   ,MIN_VECTORS_PER_PARTITION 3
);

-----
-- VECTOR index statistics:
-----

SELECT index_name, index_type, index_subtype
  FROM USER_INDEXES
 WHERE index_subtype IS NOT NULL;

SELECT JSON_SERIALIZE(IDX_PARAMS RETURNING VARCHAR2 PRETTY) AS "Detailed Info"
  FROM VECSYS.VECTOR$INDEX
 WHERE idx_name = 'CORPUS_CHUNKS_HNSW_IDX';

SET SERVEROUTPUT ON
SET LONG 100000
DECLARE
  report VARCHAR2(128);
  query_vector VECTOR;
  CURSOR curVectors IS  
    SELECT cd_id, cdc_id, SUBSTR(cdc_data, 1, 20) AS mini_data, cdc_embedded
      FROM corpus_chunks
    WHERE cd_id = 1
    ORDER BY cd_id, cdc_id;
BEGIN
  FOR qv IN curVectors
    LOOP
      
      -- Test index accuracy for vector:
      report :=
        DBMS_VECTOR.INDEX_ACCURACY_QUERY(
          OWNER_NAME => 'HOL23'
        , INDEX_NAME => 'CORPUS_CHUNKS_HNSW_IDX'
        , qv => qv.cdc_embedded
        , top_K => 10
        , target_accuracy => 90);
    
      DBMS_OUTPUT.PUT_LINE(
        'Chunk #' || qv.cd_id || '.' || qv.cdc_id || 
        ' (' || qv.mini_data || ') accuracy: ' || report
      );
        
      
    END LOOP;

END;
/

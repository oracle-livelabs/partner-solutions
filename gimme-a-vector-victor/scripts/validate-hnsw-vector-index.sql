/*
|| SQL:     validate-hnsw-vector-index.sql
|| Purpose: Uses the DBMS_VECTOR.INDEX_ACCURACY_QUERY function to display how
||          selective a HNSW index is for retrieving a limited set of "chunks"
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

SET SERVEROUTPUT ON
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

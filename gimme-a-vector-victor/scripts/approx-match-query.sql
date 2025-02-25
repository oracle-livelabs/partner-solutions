/*
|| Script:  approx-match-query.sql
|| Purpose: Use VECTOR_DISTANCE function with COSINE similarity to retrieve
||          potential answers from corpus embeddings for an APPROXIMATE search,
||          then generate and view the corresponding EXPLAIN PLAN
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

SELECT 
  VECTOR_DISTANCE(
    cdc_embedded
  , VECTOR_EMBEDDING(
      MINILML6V2 
      USING 
     'Are EV batteries safe?'
      AS DATA), COSINE) AS rating
, cd_id
, cdc_id
, SUBSTR(cdc_data, 1, 60) brief_data
  FROM corpus_chunks
 ORDER BY rating ASC
 FETCH APPROXIMATE NEXT 10 ROWS ONLY;

EXPLAIN PLAN FOR
SELECT 
  VECTOR_DISTANCE(
    cdc_embedded
  , VECTOR_EMBEDDING(
      MINILML6V2 
      USING 
     'Are EV batteries safe?'
      AS DATA), COSINE) AS rating
, cd_id
, cdc_id
, SUBSTR(cdc_data, 1, 60) brief_data
  FROM corpus_chunks
 ORDER BY rating ASC
 FETCH APPROXIMATE NEXT 10 ROWS ONLY;

SELECT plan_table_output 
  FROM TABLE(DBMS_XPLAN.DISPLAY('plan_table',NULL,'all'));

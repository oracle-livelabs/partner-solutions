/*
|| Script:  create-corpus-chunks-and-embeddings.sql
|| Purpose: "Chunks" all corpus documents and simultaneously creates embeddings
||          using the chosen ONNX LLM embedding model
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

TRUNCATE TABLE corpus_chunks;

INSERT INTO corpus_chunks
SELECT 
  CD.cd_id doc_id
, ET.embed_id cdc_id
, ET.embed_data cdc_data
, TO_VECTOR(ET.embed_vector) cdc_embedded
  FROM
    corpus_documents CD
  , DBMS_VECTOR_CHAIN.UTL_TO_EMBEDDINGS(
        DBMS_VECTOR_CHAIN.UTL_TO_CHUNKS(
          DBMS_VECTOR_CHAIN.UTL_TO_TEXT(CD.cd_data)
        , JSON('{"by":"words","overlap":"0","split":"sentence","language":"american","normalize":"all"}'))
        , JSON('{"provider":"database", "model":"MINILML6V2"}')) t 
  , JSON_TABLE(
      t.column_value
    , '$[*]' COLUMNS (
         embed_id     NUMBER PATH '$.embed_id'
       , embed_data   VARCHAR2(4000) PATH '$.embed_data'
       , embed_vector CLOB PATH '$.embed_vector')
  ) ET
;

COMMIT;

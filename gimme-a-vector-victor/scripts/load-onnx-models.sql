/*
|| Script:  load-onnx-models.sql
|| Purpose: Loads ONNX LLMs into database
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

BEGIN
    DBMS_VECTOR.DROP_ONNX_MODEL(model_name => 'MiniLML6V2' , force => TRUE);
    DBMS_VECTOR.DROP_ONNX_MODEL(model_name => 'MiniLML12V2', force => TRUE);
END;
/

BEGIN

  DBMS_VECTOR.LOAD_ONNX_MODEL(
    directory => 'DATA_PUMP_DIR'
  , file_name => 'all-MiniLM-L6-v2.onnx'
  , model_name => 'MiniLML6V2'
  , metadata => JSON('{"function" : "embedding", "embeddingOutput" : "embedding" , "input": {"input": ["DATA"]}}')
  );

  DBMS_VECTOR.LOAD_ONNX_MODEL(
    directory => 'DATA_PUMP_DIR'
  , file_name => 'all-MiniLM-L12-v2.onnx'
  , model_name => 'MiniLML12V2'
  , metadata => JSON('{"function" : "embedding", "embeddingOutput" : "embedding" , "input": {"input": ["DATA"]}}')
  );

END;
/

/*
|| Script: pkg_rag_processing.sql
|| Creates package for handling all generative AI processing for demonstrations
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

CREATE OR REPLACE PACKAGE pkg_rag_processing
/*
|| Package:         PKG_RAG_PROCESSING
|| Version:         23.2.0.0.0
|| Description:     Describes all generative AI and RAG processing
*/
IS
    FUNCTION SummaryDocument (
      vcUserQuestion   VARCHAR2    DEFAULT 'Make something up'
    )
     RETURN CLOB; 
     
END pkg_rag_processing;  
/


CREATE OR REPLACE PACKAGE BODY pkg_rag_processing
/*
|| Package Body:    PKG_RAG_PROCESSING
|| Version:         23.2.0.0.0
|| Description:     Implements all generative AI and RAG processing
|| Author:          Jim Czuprynski - Zero Defect Computing, Inc.
*/
IS
      
    FUNCTION SummaryDocument (
      vcUserQuestion   VARCHAR2    DEFAULT 'Make something up'
    )
     RETURN CLOB
    /*
    || Function:    SummaryDocument
    || Purpose:     Accepts a user question in text format and then returns an
    ||              answer by searching via exact match through all pertinent 
    ||              embeddings for appropriate document chunks, choosing the four (4)
    ||              that make the most sense, and then finally formulating the answer 
    ||              via DBMS_VECTOR_CHAIN.UTL_TO_SUMMARY
    || Scope:       Public
    */
    IS
      prompt CLOB;
      user_question CLOB;
      context CLOB;
      params CLOB;
      output CLOB;

      CURSOR cur_embedded(user_question VARCHAR2) IS
          SELECT cdc_data
            FROM corpus_chunks
           ORDER BY VECTOR_DISTANCE(cdc_embedded, VECTOR_EMBEDDING(MINILML6V2 USING user_question AS DATA), COSINE) ASC
           FETCH EXACT FIRST 4 ROWS ONLY;

    BEGIN
      -- Initialize the concatenated string
      context := '';

      -- Read this question from the user
      user_question := TO_CLOB(vcUserQuestion);

      -- Open cursor to fetch chunks relevant to the user's query
      FOR rec IN cur_embedded(user_question)
           LOOP
             -- Concatenate each value to the string
             context := context || rec.cdc_data;
           END LOOP;
       -- Concatenate strings and format it as an enhanced prompt to the LLM
       prompt :=  context;

      -----
      -- Send document for summarization:
      -----
      params := '{
      "provider": "DATABASE",
      "glevel": "SENTENCE",
      "numParagraphs": 3,
      "maxPercent": 20,
      "num_themes": 2,
      "language": "AMERICAN"
      }';

      output := DBMS_VECTOR_CHAIN.UTL_TO_SUMMARY(prompt, JSON(params));

      IF output IS NOT NULL THEN
        RETURN output;
        DBMS_LOB.FREETEMPORARY(output);
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Unexpected fatal error during SummaryDocument processing: ' || SQLCODE || ' - ' || SQLERRM);
        ROLLBACK;
        RETURN TO_CLOB('A serious error occured: ' ||  SQLCODE || ' - ' || SQLERRM);

    END SummaryDocument;

BEGIN
    -----
    -- Initialization:
    -----
    NULL;

END pkg_rag_processing;
/
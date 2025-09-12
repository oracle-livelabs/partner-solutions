/*
|| Script:  create-tables.sql
|| Purpose: Creates database objects for HOL23 schema
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

DROP TABLE IF EXISTS hol23.interactions     CASCADE CONSTRAINTS PURGE;
DROP TABLE IF EXISTS hol23.relationships    CASCADE CONSTRAINTS PURGE;
DROP TABLE IF EXISTS hol23.messaging        CASCADE CONSTRAINTS PURGE;
DROP TABLE IF EXISTS hol23.entities         CASCADE CONSTRAINTS PURGE;
DROP TABLE IF EXISTS hol23.corpus_documents CASCADE CONSTRAINTS PURGE;
DROP TABLE IF EXISTS hol23.corpus_chunks    CASCADE CONSTRAINTS PURGE;

CREATE TABLE IF NOT EXISTS hol23.entities (
    e_id          NUMBER(09)      NOT NULL
   ,e_gender      CHAR(01)        NOT NULL
   ,e_name        VARCHAR2(40)    NOT NULL
   ,e_country     CHAR(03)        NOT NULL
   ,e_tz          CHAR(06)        NOT NULL
   ,e_handle      VARCHAR2(40)    NOT NULL
   ,e_comment     VARCHAR2(512)
);

COMMENT ON TABLE hol23.entities
	IS 'Persons or Organizations posting messages within SM network';
COMMENT ON COLUMN hol23.entities.e_id      
	IS 'Entity ID. Uniquely identifies an Entity';
COMMENT ON COLUMN hol23.entities.e_gender  
	IS 'Gender';
COMMENT ON COLUMN hol23.entities.e_name    
	IS 'Name';
COMMENT ON COLUMN hol23.entities.e_country 
	IS 'Two-character abbreviation for Home Country';
COMMENT ON COLUMN hol23.entities.e_tz      
	IS 'Home Time Zone (UTC)';
COMMENT ON COLUMN hol23.entities.e_handle  
	IS 'Social Media Handle';
COMMENT ON COLUMN hol23.entities.e_comment 
	IS 'Entity commentary / description';

CREATE TABLE IF NOT EXISTS hol23.relationships (
    r_src         NUMBER(09)      NOT NULL
   ,r_tgt         NUMBER(09)      NOT NULL
   ,r_type        CHAR(20)        NOT NULL	
   ,r_comment     VARCHAR2(512)
);

COMMENT ON TABLE hol23.relationships
	IS 'Establishes hol23.relationships between entities';
COMMENT ON COLUMN hol23.relationships.r_src
	IS 'Relationship Source Entity ID';
COMMENT ON COLUMN hol23.relationships.r_tgt
	IS 'Relationship Target Entity ID';
COMMENT ON COLUMN hol23.relationships.r_type   
	IS 'Relationship Type';
COMMENT ON COLUMN hol23.relationships.r_comment
	IS 'Relationship commentary / description';
	
CREATE TABLE IF NOT EXISTS hol23.messaging (
    msg_id            NUMBER(13)      NOT NULL
   ,msg_dtm           DATE            NOT NULL	
   ,msg_polarity      NUMBER(8,5)     DEFAULT 0  
   ,msg_subjectivity  NUMBER(8,5)     DEFAULT 0
   ,msg_topic         VARCHAR2(12)    NOT NULL
   ,msg_text          VARCHAR2(4000)  NOT NULL
);

COMMENT ON TABLE hol23.messaging
	IS 'Messages created via random and programmatic propagation';
COMMENT ON COLUMN hol23.messaging.msg_id          
	IS 'Message ID. Uniquely identifies a message';
COMMENT ON COLUMN hol23.messaging.msg_dtm         
	IS 'Message Sent Timestamp';
COMMENT ON COLUMN hol23.messaging.msg_polarity    
	IS 'Message Polarity. Ranges from -5 (extremely negative) to +5 (extremely positive)';
COMMENT ON COLUMN hol23.messaging.msg_subjectivity
	IS 'Message Subjectivity. Rates how apparently subjective a message or response is';
COMMENT ON COLUMN hol23.messaging.msg_text        
	IS 'Message Text';

CREATE TABLE IF NOT EXISTS hol23.interactions  (
    smi_id          NUMBER(13)    NOT NULL
   ,smi_msg_id      NUMBER(13)    NOT NULL
   ,smi_e_id        NUMBER(09)    NOT NULL
   ,smi_type        CHAR(12)      NOT NULL
   ,smi_intensity   NUMBER(02)    NOT NULL     
   ,smi_ref_msg_id  NUMBER(13)      
);

COMMENT ON TABLE hol23.interactions
	IS 'Defines hol23.interactions between messengers (entities) and the messages they send within the social media (SM) network';
COMMENT ON COLUMN hol23.interactions.smi_id   
	IS 'SM Interaction ID. Uniquely identifies a SM interaction';
COMMENT ON COLUMN hol23.interactions.smi_e_id 
	IS 'SM Interaction Entity ID. Identifies which entity created the SM interaction';
COMMENT ON COLUMN hol23.interactions.smi_type 
	IS 'SM Interaction Type. Desribes the type of interaction: Post (a newly-created message), Like (response to an existing post), Comment (response to an existing post), or Repost (sending existing post to others in SM network)';
COMMENT ON COLUMN hol23.interactions.smi_ref_msg_id
	IS 'SM Interaction Message Reference ID. For Likes, Comments, and Reposts, this refers to the original Post initiating the respnse';
COMMENT ON COLUMN hol23.interactions.smi_intensity
	IS 'SM Interaction Intensity Rating. For Likes, this may be a negative or positive number from -5 to +5)';


CREATE TABLE IF NOT EXISTS hol23.corpus_documents (
  cd_id      NUMBER(8,0)
, cd_status  CHAR(12)
, cd_data    BLOB
);

COMMENT ON TABLE hol23.corpus_documents
	IS 'Stores documents that define private body of knowledge for LLM model use';
COMMENT ON COLUMN hol23.corpus_documents.cd_id   
	IS 'Corpus Document ID. Uniquely identifies a corpus document';
COMMENT ON COLUMN hol23.corpus_documents.cd_status   
	IS 'Corpus Document Status';
COMMENT ON COLUMN hol23.corpus_documents.cd_data
	IS 'Corpus Document. Stored as BLOB for eventual chunking and embedding via ONNX LLM';

CREATE TABLE IF NOT EXISTS hol23.corpus_chunks(
  cd_id         NUMBER(8,0)
, cdc_id        NUMBER(8,0)
, cdc_data      VARCHAR2(4000)
, cdc_embedded  VECTOR
);

COMMENT ON TABLE hol23.corpus_chunks
	IS 'Stores documents that define private body of knowledge for LLM model use';
COMMENT ON COLUMN hol23.corpus_chunks.cd_id   
	IS 'Corpus Document ID. Uniquely identifies a corpus document';
COMMENT ON COLUMN hol23.corpus_chunks.cdc_id   
	IS 'Corpus Document Chunk ID. Uniquely identifies a single chunk of a corpus document';
COMMENT ON COLUMN hol23.corpus_chunks.cdc_data    
	IS 'Corpus Document Chunk';
COMMENT ON COLUMN hol23.corpus_chunks.cdc_embedded    
	IS 'Corpus Document Embedding. Created via LLM and stored as series of arrays within VECTOR datatype';


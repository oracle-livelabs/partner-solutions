/*
|| Script:  create-constraints.sql
|| Purpose: Creates primary and foreign key constraints and indexes for HOL23 schema
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

-----
-- Primary Key constraints:
-----
ALTER TABLE hol23.entities
  ADD CONSTRAINT entities_pk
  PRIMARY KEY (e_id)
  USING INDEX (
    CREATE UNIQUE INDEX hol23.entities_pk_idx
        ON hol23.entities (e_id)
    );

ALTER TABLE hol23.relationships
  ADD CONSTRAINT relationships_pk
  PRIMARY KEY (r_src, r_tgt, r_type)
  USING INDEX (
    CREATE UNIQUE INDEX hol23.relationships_pk_idx
        ON hol23.relationships (r_src, r_tgt, r_type)
    );

ALTER TABLE hol23.messaging
  ADD CONSTRAINT messaging_pk
  PRIMARY KEY (msg_id)
  USING INDEX (
    CREATE UNIQUE INDEX hol23.messaging_pk_idx
        ON hol23.messaging (msg_id)
    );

ALTER TABLE hol23.interactions
  ADD CONSTRAINT interactions_pk
  PRIMARY KEY (smi_id)
  USING INDEX (
    CREATE UNIQUE INDEX hol23.interactions_pk_idx
        ON hol23.interactions (smi_id)
    );

-----
-- Foreign Key constraints:
-----
ALTER TABLE hol23.relationships
  ADD CONSTRAINT rel_src_eid_fk
  FOREIGN KEY (r_src)
  REFERENCES hol23.entities (e_id);

ALTER TABLE hol23.relationships
  ADD CONSTRAINT rel_tgt_eid_fk
  FOREIGN KEY (r_tgt)
  REFERENCES hol23.entities (e_id);

ALTER TABLE hol23.interactions
  ADD CONSTRAINT interactions_eid_fk
  FOREIGN KEY (smi_e_id)
  REFERENCES hol23.entities (e_id);

ALTER TABLE hol23.interactions
  ADD CONSTRAINT interactions_msg_fk
  FOREIGN KEY (smi_msg_id)
  REFERENCES hol23.messaging (msg_id);    
  
ALTER TABLE hol23.interactions
  ADD CONSTRAINT interactions_msg_ref_fk
  FOREIGN KEY (smi_ref_msg_id)
  REFERENCES hol23.messaging (msg_id);    

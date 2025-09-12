/*
|| Script:  view-opg-metadata.sql
|| Purpose: Shows queries for drilling into OPG metadata
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

-- View OPG elements and underlying tables
SELECT * FROM user_pg_elements;

-- View OPG element details
SELECT * FROM user_pg_prop_definitions;

-- Show details of OPG property names
SELECT * FROM user_pg_label_properties;

-- Show details on OPG edges and node relationships
SELECT * FROM user_pg_edge_relationships;

-- What keys are the OPGs using to uniquely identify elements?
SELECT * FROM user_pg_keys;

/*
|| Script:  load-corpus-documents.sql
|| Purpose: Populates CORPUS_DOCUMENTS table in HOL23 schema using specific 
||          documents previously copied into the database's DATA_PUMP_DIR directory
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

TRUNCATE TABLE corpus_documents;

INSERT INTO corpus_documents(cd_id, cd_status, cd_data)
VALUES(001, 'VALID', TO_BLOB(BFILENAME('DATA_PUMP_DIR', 'USEPA_Condensed.pdf')));
INSERT INTO corpus_documents(cd_id, cd_status, cd_data)
VALUES(002, 'VALID', TO_BLOB(BFILENAME('DATA_PUMP_DIR', 'GlobalEVOutlook2023.pdf')));
INSERT INTO corpus_documents(cd_id, cd_status, cd_data)
VALUES(003, 'VALID', TO_BLOB(BFILENAME('DATA_PUMP_DIR', 'GlobalEVOutlook2024.pdf')));
INSERT INTO corpus_documents(cd_id, cd_status, cd_data)
VALUES(004, 'VALID', TO_BLOB(BFILENAME('DATA_PUMP_DIR', 'Global-LCA-passenger-cars-jul2021_0.pdf')));
INSERT INTO corpus_documents(cd_id, cd_status, cd_data)
VALUES(005, 'VALID', TO_BLOB(BFILENAME('DATA_PUMP_DIR', 'TheAtlantic_TheMostImportantTechnologyOf2023WasntAI.pdf')));
INSERT INTO corpus_documents(cd_id, cd_status, cd_data)
VALUES(006, 'VALID', TO_BLOB(BFILENAME('DATA_PUMP_DIR', 'TheGuardian_AreElectricCarsTooHeavyForRoadsBridgesAndCarParks.pdf')));
INSERT INTO corpus_documents(cd_id, cd_status, cd_data)
VALUES(007, 'VALID', TO_BLOB(BFILENAME('DATA_PUMP_DIR', 'TheGuardian_DoElectricCarsHaveAnAirPollutionProblem.pdf')));
INSERT INTO corpus_documents(cd_id, cd_status, cd_data)
VALUES(008, 'VALID', TO_BLOB(BFILENAME('DATA_PUMP_DIR', 'TheGuardian_DoElectricCarsPoseAGreaterFireRiskThanPetrolOrDieselVehicles.pdf')));
INSERT INTO corpus_documents(cd_id, cd_status, cd_data)
VALUES(009, 'VALID', TO_BLOB(BFILENAME('DATA_PUMP_DIR', 'TheGuardian_DoElectricCarsReallyProduceFewerCarbonEmissionsThanPetrolOrDieselVehicles.pdf')));
INSERT INTO corpus_documents(cd_id, cd_status, cd_data)
VALUES(010, 'VALID', TO_BLOB(BFILENAME('DATA_PUMP_DIR', 'RecurrentAuto_HowLongDoElectricCarBatteriesLast.pdf')));
INSERT INTO corpus_documents(cd_id, cd_status, cd_data)
VALUES(011, 'VALID', TO_BLOB(BFILENAME('DATA_PUMP_DIR', 'RecurrentAuto_StudyWinterAndColdWeatherEVRangeLossIn10000PlusCars.pdf')));

COMMIT;

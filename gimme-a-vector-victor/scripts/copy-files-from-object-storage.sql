/*
|| Script: copy-files-from-object-storage.sql
|| Purpose: Copies all corpus documents in PDF format to DATA_PUMP_DIR directory
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

SET SERVEROUTPUT ON
DECLARE 
    objFileName  VARCHAR2(512);

    CURSOR curDPDFiles IS
      SELECT object_name
        FROM DBMS_CLOUD.LIST_FILES('DATA_PUMP_DIR');

    TYPE objFilenames 
      IS VARRAY(13) 
      OF VARCHAR2(512);

    fnames objFileNames := 
    objFileNames( 
      'all-MiniLM-L6-v2.onnx'
    , 'all-MiniLM-L12-v2.onnx'
    , 'USEPA_Condensed.pdf'
    , 'GlobalEVOutlook2023.pdf'
    , 'GlobalEVOutlook2024.pdf'
    , 'Global-LCA-passenger-cars-jul2021_0.pdf'
    , 'TheAtlantic_TheMostImportantTechnologyOf2023WasntAI.pdf'
    , 'TheGuardian_AreElectricCarsTooHeavyForRoadsBridgesAndCarParks.pdf'
    , 'TheGuardian_DoElectricCarsHaveAnAirPollutionProblem.pdf'
    , 'TheGuardian_DoElectricCarsPoseAGreaterFireRiskThanPetrolOrDieselVehicles.pdf'
    , 'TheGuardian_DoElectricCarsReallyProduceFewerCarbonEmissionsThanPetrolOrDieselVehicles.pdf'
    , 'RecurrentAuto_HowLongDoElectricCarBatteriesLast.pdf'
    , 'RecurrentAuto_StudyWinterAndColdWeatherEVRangeLossIn10000PlusCars.pdf'
    );

BEGIN
    -----
    -- First, remove all files from DATA_PUMP_DIR, as data loading jobs may have
    -- introduced additional files we're uninterested in
    ----- 
    FOR o IN curDPDFiles
        LOOP
            DBMS_CLOUD.DELETE_FILE(directory_name => 'DATA_PUMP_DIR' ,file_name => o.object_name);
        END LOOP;

    FOR i IN 1..13
        LOOP
            objFileName  := 
               'https://objectstorage.us-ashburn-1.oraclecloud.com/n/c4u04/b/data-lake/o/' || fnames(i);
            DBMS_CLOUD.GET_OBJECT(
                credential_name => NULL
               ,object_uri => objFileName
               ,directory_name => 'DATA_PUMP_DIR');
        END LOOP;

END;
/

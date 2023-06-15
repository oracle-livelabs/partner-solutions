# How do I Create Oracle Recovery Manager (RMAN) Catalog?

Duration: 10 minutes

## Create Oracle Recovery Manager (RMAN) Catalog

In Oracle, Recovery Manager (RMAN) is a utility that can be used to backup and recovery the database and it simplifies backing up, restoring, and recovering database or database files. 

Recovery catalog is schema used by RMAN to store one or more Oracle databases metadata. The 
metadata includes information about target database, RMAN config settings, Stored scripts configuration and keeps track of database files names, online redo logs files, standby redo log files, temp files, archived redo log files, image copies, backup pieces and backup sets for both primary and standby databases. 

It is highly recommended to create recovery catalog schema in a separate database instead of the target databases and enable ARCHIVELOG mode for Recovery Catalog database

1.	Create recovery catalog tablespace and user

	```
	<copy>
	SQL> CREATE TABLESPACE rcatbs 
	datafile '/oracle/oradata/rcat/rcattbs01.dbf' size 100m
	reuse autoextend on;
	</copy>

	Tablespace created.
	```

	```
	<copy>
	SQL> CREATE USER rcat IDENTIFIED BY rcatpassword
	DEFAULT TABLESPACE rcattbs
	TEMPORARY TABLESPACE temp
	QUOTA UNLIMITED ON rcattbs;
	</copy>

	User created.
	```

2.	Grants recovery catalog access recovery catalog user

	```
	<copy>
	SQL> GRANT recovery_catalog_owner TO rcat;
	</copy>
	
	Grant succeeded.
	```

3.	Create Recovery Catalog

	```
	<copy>
	$rman target / catalog rcat/ rcatpassword@rcatdb
	</copy>

	Recovery Manager: Release 19.0.0.0.0 - Production on Wed May 31 12:55:27 2023
	Version 19.10.0.0.0

	Copyright (c) 1982, 2019, Oracle and/or its affiliates.  All rights reserved.

	connected to target database: RCATDB (DBID=4567445670)
	connected to recovery catalog database

	RMAN> CREATE CATALOG TABLESPACE  rcattbs;
	recovery catalog created.
	```

	Recovery catalog helps as centralized metadata location for all databases, and it helps easily report from once location. In addition, you can store metadata history longer than Control file.

## Learn More

* [Oracle RMAN Backup Reference](https://www.oracleracexpert.com/search/label/RMAN%20Backup)
* [Oracle Backup and Recovery Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/rcmrf/index.html)
* [Zero Data Loss Recovery Appliance](https://www.oracle.com/engineered-systems/zero-data-loss-recovery-appliance/)
* [Zero Data Loss Autonomous Recovery Service](https://www.oracle.com/database/zero-data-loss-autonomous-recovery-service/)
* [Oracle Database Backup Cloud Service](https://docs.oracle.com/en/cloud/paas/db-backup-cloud/index.html)

## Acknowledgements

* **Author** - Satishbabu Gunukula, Oracle ACE Pro
* **Last Updated By/Date** - Satishbabu Gunukula,  June 2023

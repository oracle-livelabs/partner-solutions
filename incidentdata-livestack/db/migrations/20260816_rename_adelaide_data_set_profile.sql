/* Rename the existing recoverable Basic Data profile without changing its
   backup tables or its contained demonstration data. Run once on databases
   bootstrapped before the Adelaide Data Set Profile naming change. */
UPDATE demo_data_profiles
SET profile_code = 'ADELAIDE_DATA',
    profile_name = 'Adelaide Data Set Profile',
    city_label = 'Adelaide'
WHERE profile_code = 'BASIC_DATA';

COMMENT ON TABLE demo_data_profiles IS 'Synthetic city data-profile registry for the Police Adelaide teaching app. The Adelaide Data Set Profile is recoverable; Perth and Brisbane are planned future variants.';
COMMIT;

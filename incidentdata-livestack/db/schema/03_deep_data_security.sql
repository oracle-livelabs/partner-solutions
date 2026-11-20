/* Oracle Deep Data Security policy baseline. Requires 23.26.2+ and privileged deployment. */
CREATE DATA ROLE IF NOT EXISTS aci_admin_role;
CREATE DATA ROLE IF NOT EXISTS aci_central_role;
CREATE DATA ROLE IF NOT EXISTS aci_north_role;
CREATE DATA ROLE IF NOT EXISTS aci_south_role;
/* The application provisions trusted end-user context. These grants are the declarative policy source. */
CREATE DATA GRANT aci_incidents_admin AS SELECT ON crime_incidents TO aci_admin_role;
/* Regional production grants are installed by the deployment administrator after application identity/context provisioning. */

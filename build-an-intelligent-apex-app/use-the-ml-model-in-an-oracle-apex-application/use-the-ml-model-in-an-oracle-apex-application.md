# Use the ML Model in an Oracle APEX Application

## Introduction

TODO

Estimated Time: 30 minutes

### Oracle APEX

TODO

### Objectives

In this lab, you will:

* Gather the information required for working with the deployed ML model using REST.
* Create an Oracle APEX application that allows the user to manage records about HDB flats for sale.
* Predict the price of the HDB flat when a record is created.

### Prerequisites

This lab assumes that you have:

* Access to an Oracle Cloud tenancy.
* Provisioned a workspace and schema on the Oracle Autonomous Database.
* Performed all the steps for loading the open data set, use AutoML UI to generate, and deploy a machine learning model.

## Task 1: Gather Required Information for Calling the Deployed ML Model

1. ...
![](./images/access-available-oml-models.png)
1. ...
![](./images/access-deployed-models.png)
1. ...
![](./images/view-openapi-specifications-for-deployed-model.png)
1. ...
![](./images/openapi-specification-for-deployed-model.png)

## Task 2: Create a Database Table to Store Records of HDB Flats

1. Login to apex
![](./images/login-to-apex-workspace.png)
1. Go to *SQL Command*.
![](./images/launch-sql-command.png)
1. Copy the SQL statement below, and paste the content into the worksheet.
    ```sql
    <copy>
    create table resale_flat(
        resale_flat_id number generated always as identity
        , block varchar2(255) not null
        , street_name varchar2(255) not null
        , storey number not null
        , town varchar2(255) not null
        , flat_type varchar2(255)
        , flat_model varchar2(255)
        , floor_area_sqm number not null
        , lease_commence_date number not null
        , constraint resale_flat_pk primary key(resale_flat_id)
    )
    /
    </copy>
    ```
![](./images/create-table-using-sql-command.png)
1. Click the link *App Builder* to return to the App Builder.
![](./images/return-to-app-builder.png)

## Task 3: Create an Oracle APEX Application to Manage Records of HDB Flats

1. Click to create new app
![](./images/click-to-create-a-new-app.png)
1. Click the button *New Application*.
![](./images/select-new-application.png)
1. Enter the desired name for the application, for example, *My Real Estate Inventory*.
![](./images/name-the-application.png)
1. Scroll down and modify the authentication scheme to use *Database Accounts*, and then click the button *Create Application* to create the application.
![](./images/change-the-authentication-scheme.png)
1. After the application has been created, the browser will redirect to the application's homepage. Click the button *Create Page >* to launch the *Create a Page* wizard.
![Click button to launch the create a page wizard.](./images/create-a-page.png)
1. On the second page of this application, we want a list of properties displayed as a table. Select to create an *Interactive Report*.
![Select to create an interactive report.](./images/select-to-create-an-interactive-report.png)
1. Enter a name for the interactive report, and then toggle the option *Include From Page*. Additional
![](./images/enter-report-details-and-select-to-create-form.png)
1. ...
![](./images/click-to-select-table.png)
1. ...
![](./images/search-and-choose-desired-table.png)
1. ...
![](./images/proceed-to-next-step.png)
1. ...
![](./images/select-primary-key.png)
1. ...

## Task 4: Run the Application

1. Return to the application homepage.
![](./images/return-to-application-homepage.png)
1. Run the application
![](./images/run-the-application.png)
1. Login
![](./images/login-to-application.png)
1. Go to Resale Flats Interactive Report
1. Create
1. Edit/view

## Task 5: Modify the Application to the Predict Sale Price When a Record is Created or Modified

1. Go to the application's *Shared Components* by clicking on the icon indicated by the red box.
![Go to shared components.](./images/go-to-shared-components.png)
1. Click the link *Application Definitions*.
![Edit the application definitions.](./images/go-to-application-definition.png)
1. Click the tab *Substitution Strings*, and then enter the following:
![Add substitution strings to the application definition.](./images/enter-substitution-strings.png)

    | Substitution String | Substitution Value                                                      |
    | ------------------- | ----------------------------------------------------------------------- |
    | `G_USERNAME`        | *Database user with access to OML and deployed model.*                  |
    | `G_PASSWORD`        | *The database user's password.*                                         |
    | `G_OML_SERVICE_URL` | `https://{TENANCY_ID}-{DATABASE_NAME}.adb.{REGION}.oraclecloudapps.com` |
    | `G_TOKEN_PATH`      | `/omlusers/api/oauth2/v1/token`                                         |
    | `G_MODEL_PATH`      | `/omlmod/v1/deployment/{URI}/score`                                     |

1. Return to the *Resale Flat Details* page by using the search functionality. Click inside the search field, enter the term *resale flat details*, and then click the target page.
![Search and navigate to the resale flat details page.](./images/search-and-navigate-to-resale-flat-details-page.png)
1. Right click on the *Region Body*, and then click the menu item *Create Page Item*.
![Create a new page item.](./images/right-click-to-create-page-item.png)
1. Set the page item's name to *`P3_ESTIMATED_VALUE`*, and type, *Display Only*.
![Set the page item properties.](./images/set-page-item-properties.png)
1. Scroll down and set the server-side condition for the page item to render only if the page item *`P3_RESALE_FLAT_ID`* is not null. The page item will only render when viewing an existing record.
![Set the server-side condition for the page item.](./images/set-server-side-condition-for-page-item.png)
1. On the left pane, under the *Rendering* tab, expand the nodes *Pre-Rendering*, *Before Header*, then *Processes*. Right-click on the node *Processes*, and then click the menu item *Create Process*.
![Create a new before header process.](./images/right-click-to-create-process.png)
1. Enter a suitable name for the process, for example, *Estimate Value of Resale Flat*. Then, scroll down, and under *Source*, click the icon next to the field label *PL/SQL Code* to open the PL/SQL code editor.
![Name the process and then open the PL/SQL code editor.](./images/name-process-and-expand-plsql-code-editor.png)
1. Copy the PL/SQL anonymous procedure below to the clipboard.
    ```sql
    <copy>
    declare
        l_token varchar2(32767);
        l_response clob;
    begin
        -- 1. Perform authentication and obtain a token.
        apex_web_service.g_request_headers(1).name := 'Content-Type';
        apex_web_service.g_request_headers(1).value := 'application/json';

        l_response := apex_web_service.make_rest_request(
            p_url => :G_OML_SERVICE_URL || :G_TOKEN_PATH
            , p_http_method => 'POST'
            , p_body => json_object(
                'grant_type' value 'password'
                , 'username' value :G_USERNAME
                , 'password' value :G_PASSWORD
            )
        );

        -- 2. Retrieve the token.
        if apex_web_service.g_status_code = 200 then
            apex_debug.info(l_response);
            apex_json.parse(p_source => l_response);

            l_token := apex_json.get_varchar2(p_path => 'accessToken');
        else
            raise_application_error(-20001, 'Authentication '
                || 'request failed. HTTP status code returned: '
                || apex_web_service.g_status_code);
        end if;

        -- 3. Call the deployed ML model REST endpoint.
        apex_web_service.clear_request_headers;

        apex_web_service.g_request_headers(1).name := 'Authorization';
        apex_web_service.g_request_headers(1).value := 'Bearer ' || l_token;

        apex_web_service.g_request_headers(2).name := 'Content-Type';
        apex_web_service.g_request_headers(2).value := 'application/json';

        l_response := apex_web_service.make_rest_request(
            p_url => :G_OML_SERVICE_URL || :G_MODEL_PATH
            , p_http_method => 'POST'
            , p_body => json_object(
                'inputRecords' value json_array(
                    json_object(
                        'BLOCK' value :P3_BLOCK
                        , 'FLOOR_AREA_SQM' value
                            to_number(:P3_FLOOR_AREA_SQM)
                        , 'LEASE_COMMENCE_DATE' value
                            to_number(:P3_LEASE_COMMENCE_DATE)
                        , 'STOREY_TO' value to_number(:P3_STOREY)
                        , 'STREET_NAME' value :P3_STREET_NAME
                        , 'TOWN' value :P3_TOWN
                        , 'TRANSACTION_YEAR'
                            value extract(year from sysdate)
                    )
                )
            )
        );

        -- 4. Parse the results.
        if apex_web_service.g_status_code != 200 then
            raise_application_error(-20002
                , 'Error predicting results. HTTP status code: '
                || apex_web_service.g_status_code);
        else
            select round(results.regression)
            into :P3_ESTIMATED_VALUE
            from json_table(
                l_response, '$.scoringResults[0]' columns(regression)
            ) as results;
        end if;
    end;
    </copy>
    ```
1. Paste the contents of the clipboard into the code editor, then, click the code validation icon on the toolbar. If the code validates successfully, click the button *OK*.
![Paste, validate the code, and then click the button OK.](./images/enter-process-plsql-code.png)
1. Scroll down and set the server-side condition for the process to execute only if the page item *`P3_RESALE_FLAT_ID`* is not null. The process will only execute when viewing an existing record.
![Set the server-side condition for the process.](./images/set-server-side-condition-for-process.png)
1. Click the button *Save* on the top-right corner of the page to save all changes made on this page.
![Save all changes.](./images/save-all-changes.png)
1. Repeat Task 4 to view a resale flat's details. The predicted sales price should now appear at the bottom of the drawer.
![The resale flat details with the new estimated value field.](./images/resale-flat-details-with-estimated-value.png)

Congratulations! You have **completed** all the necessary labs and tasks.

## Acknowledgements

* **Author** - Adrian Png, Senior Cloud Solutions Architect, Insum Solutions Inc.
* **Last Updated By/Date** - Adrian Png, June 2023

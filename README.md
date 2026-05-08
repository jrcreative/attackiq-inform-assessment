# AttackIQ Inform Assessment Plugin

The **AttackIQ Inform Assessment** plugin is an interactive React-based assessment tool designed for WordPress. It allows visitors to take a security assessment, receive personalized recommendations, and download their results in PDF or JSON format. The plugin also integrates with Marketo for lead generation.

## Features

-   **Interactive Assessment**: A user-friendly, step-by-step wizard interface built with React.
-   **Dynamic Recommendations**: Provides tailored advice based on user responses.
-   **PDF & JSON Reports**: Users can download a detailed report of their assessment results.
-   **Marketo Integration**: Seamless integration with Marketo forms to gate results and capture leads.
-   **Customizable CTA**: Configurable "Contact Us" button and link on the results page.
-   **Responsive Design**: Optimized for desktop and mobile devices.

## Installation

1.  Download the `attackiq-inform-assessment.zip` file.
2.  Log in to your WordPress Admin Dashboard.
3.  Navigate to **Plugins > Add New**.
4.  Click **Upload Plugin** and select the zip file.
5.  Click **Install Now** and then **Activate**.

## Configuration

Once activated, you can configure the plugin settings via the WordPress Admin Dashboard.

1.  Navigate to **Settings > INFORM Assessment**.
2.  **Marketo Integration**:
    -   **Marketo Form ID**: The ID of the form you want to use for gating content.
    -   **Marketo Instance**: Your Marketo instance URL (e.g., `app-ab33.marketo.com`).
    -   **Munchkin ID**: Your Marketo Munchkin ID.
    -   **Gate Downloads**: Check this box to require users to fill out the Marketo form before downloading their PDF/JSON results.
3.  **Call to Action Settings**:
    -   **Contact Page URL**: The URL where the "Contact Us" button should link to.
    -   **Contact Button Text**: The text to display on the button (e.g., "Improve Your Score").
4.  Click **Save Changes**.

## Usage

To display the assessment on a page or post, use the `[inform_assessment]` shortcode.

### Basic Usage
```
[inform_assessment]
```

### Advanced Usage (Overriding Settings)
You can override the global settings for specific instances of the assessment by passing attributes to the shortcode:

```
[inform_assessment marketo_form_id="1234" gate_downloads="yes"]
```

**Supported Attributes:**
-   `marketo_form_id`: Override the default Marketo Form ID.
-   `marketo_instance`: Override the default Marketo Instance URL.
-   `munchkin_id`: Override the default Munchkin ID.
-   `gate_downloads`: Set to `"yes"` or `"no"` to enable/disable gating for this specific instance.

## Development

This plugin is built using `@wordpress/scripts`, which provides a modern build setup with Webpack, Babel, and other tools.

### Prerequisites

-   Node.js and npm (or yarn) installed on your machine.
-   A local WordPress development environment.

### Setup

1.  Clone the repository into your WordPress plugins directory:
    ```bash
    cd wp-content/plugins
    git clone <repository-url> attackiq-inform-assessment
    ```
2.  Navigate to the plugin directory:
    ```bash
    cd attackiq-inform-assessment
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```

### Available Scripts

-   **Start Development Server**: Compiles the code for development and watches for changes.
    ```bash
    npm start
    ```
-   **Build for Production**: Compiles and minifies the code for production.
    ```bash
    npm run build
    ```
-   **Format Code**: Tips code using Prettier.
    ```bash
    npm run format
    ```
-   **Lint Code**: Lints JavaScript and CSS.
    ```bash
    npm run lint:js
    ```
-   **Create Zip Archive**: Builds the project and creates a zip file for distribution.
    ```bash
    npm run zip
    ```

## External REST API

External tools (Salesforce sync jobs, BI exports, ad-hoc reporting) can pull submission data from a read-only REST API.

### Authentication

Generate an API key from **Settings > INFORM Assessment > External REST API > Generate New Key**. The plain key is shown exactly once — copy it immediately, only its prefix is recoverable afterwards.

Send the key on every request via the `X-AIQ-Key` header:

```
X-AIQ-Key: 0b3f…full-key…
```

(Logged-in admins with `manage_options` may also call these endpoints from the browser without a key.)

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/wp-json/aiq/v1/submissions` | Paginated, filterable list. Pagination via `X-WP-Total` / `X-WP-TotalPages` response headers. |
| `GET` | `/wp-json/aiq/v1/submissions/{id}` | Full record incl. answers, recommendations, and threat profile. |

### List filters (`GET /submissions`)

| Param | Type | Notes |
| --- | --- | --- |
| `date_from`, `date_to` | datetime (`YYYY-MM-DD HH:MM:SS`) | Inclusive bounds on `created_at` |
| `min_score`, `max_score` | float (0-1) | Bounds on overall maturity ratio |
| `sector` | string | Exact match against the Threat Profile sector value |
| `email` | string | Substring match (LIKE) |
| `ctem_skipped` | `0` or `1` | Filter rows where the user opted out of CTEM |
| `page`, `per_page` | int | Defaults: `1`, `25`. `per_page` capped at `100` |
| `orderby` | `id`, `created_at`, `overall_score`, `sector`, `email` | Default `created_at` |
| `order` | `ASC`, `DESC` | Default `DESC` |

### Sample requests

```bash
# Latest 5 submissions
curl -H "X-AIQ-Key: $AIQ_KEY" \
  "https://attackiq.com/wp-json/aiq/v1/submissions?per_page=5"

# Submissions since May 1 with maturity ratio above 0.4
curl -H "X-AIQ-Key: $AIQ_KEY" \
  "https://attackiq.com/wp-json/aiq/v1/submissions?date_from=2026-05-01&min_score=0.4"

# Single record with full payload
curl -H "X-AIQ-Key: $AIQ_KEY" \
  "https://attackiq.com/wp-json/aiq/v1/submissions/42"
```

### Sample list response

```json
[
  {
    "id": 42,
    "created_at": "2026-05-05 16:31:08",
    "email": "lead@example.com",
    "first_name": "Jordan",
    "last_name": "Reyes",
    "company": "Example Co",
    "sector": "Financial Services",
    "region": "North America",
    "revenue_band": "$100M-$1B",
    "headcount_band": "1,001-5,000",
    "regulatory": ["PCI-DSS", "SOX"],
    "data_sensitivity": ["Payment / Financial Data"],
    "overall_score": 0.62,
    "cti_score": 3,
    "dm_score": 4,
    "te_score": 2,
    "ctem_score": 3,
    "ctem_skipped": false,
    "maturity_level": 3
  }
]
```

The single-record response includes the same fields plus `answers`, `recommendations`, `threat_profile`, `cpt_post_id`, `ip`, and `user_agent`.

### Errors

| Status | Code | Cause |
| --- | --- | --- |
| `401` | `aiq_api_key_missing` | No `X-AIQ-Key` header sent |
| `401` | `aiq_api_key_not_configured` | Server has no key generated yet |
| `403` | `aiq_api_key_invalid` | Key did not match the stored hash |
| `404` | `aiq_submission_not_found` | Single-record id does not exist |

### Rotating the key

Click **Regenerate Key** on the settings page. Existing integrations stop working immediately — re-distribute the new key to any consumers. Use **Revoke Key** to disable the API entirely.

## Marketo Hidden Fields

The plugin posts the assessment payload into Marketo form **2844** (configurable from the settings page) by populating hidden fields on submit. Your Marketo admin needs to add the fields below to that form so the values arrive in your instance and pass through to Salesforce.

All multi-select values (Threat Profile regulatory frameworks, data sensitivity classes) are joined with `; ` so Marketo and Salesforce see plain text rather than JSON arrays.

### Existing fields (pre-Phase 2)

| Marketo API name | Source value |
| --- | --- |
| `INFORM_Security_Assessment__c` | Full assessment JSON payload (stringified) |
| `INFORM_Overall_Score__c` | Overall maturity level (0-5) |
| `INFORM_Maturity_Level__c` | Maturity label (`Initial`, `Developing`, …) |
| `INFORM_CTI_Score__c` | CTI section maturity level (0-5) |
| `INFORM_DM_Score__c` | Defensive Measures maturity level (0-5) |
| `INFORM_TE_Score__c` | Test & Evaluation maturity level (0-5) |
| `INFORM_Assessment_Date__c` | ISO timestamp of submission |
| `INFORM_Download_Type__c` | `PDF` or `JSON` |
| `INFORM_Assessment_Completed__c` | `true` |

### New fields for Phase 2

| Marketo API name | Source value |
| --- | --- |
| `INFORM_CTEM_Score__c` | CTEM section maturity level (0-5). Empty when the user enabled **Skip CTEM Assessment**. |
| `INFORM_TP_Sector__c` | Threat Profile · primary industry (e.g. `Financial Services`) |
| `INFORM_TP_Region__c` | Threat Profile · primary operating region |
| `INFORM_TP_Revenue__c` | Threat Profile · annual revenue band |
| `INFORM_TP_Headcount__c` | Threat Profile · employee headcount band |
| `INFORM_TP_Regulatory__c` | Threat Profile · regulatory frameworks (multi-select, joined with `; `) |
| `INFORM_TP_DataSensitivity__c` | Threat Profile · data classes held (multi-select, joined with `; `) |

### What happens if a field is missing

`form.setValues()` silently ignores any hidden field that doesn't yet exist on the Marketo form, so an out-of-sync admin form never breaks the user-facing submit flow. Field names are case-sensitive and must match exactly.

## File Structure

-   `attackiq-inform-assessment.php`: The main plugin file. Handles initialization, shortcodes, and admin settings.
-   `src/`: Contains the React source code.
    -   `index.js`: Entry point for the React application.
    -   `components/`: React components (Wizard, QuestionBlock, etc.).
    -   `data/`: Configuration data (questions, scoring logic).
    -   `utils/`: Utility functions (PDF generation, API calls).
-   `build/`: Compiled assets (generated by `npm run build`).
-   `includes/`: PHP classes and helper files.

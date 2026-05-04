<?php
/**
 * Phase 2 — REST endpoints for the assessment.
 *
 * `POST /aiq/v1/submit`         — public submission. Dual-writes to the
 *                                 legacy aiq_submission CPT *and* the new
 *                                 wp_aiq_submissions table. CPT continues
 *                                 to receive writes during the transition
 *                                 period; a table failure is logged but
 *                                 does not break the user-facing submit.
 *
 * `POST /aiq/v1/_admin/backfill-batch` — capability-gated (manage_options +
 *                                 wp_rest nonce) endpoint that runs a single
 *                                 backfill batch. Wired up to the "Run
 *                                 Backfill" button on the settings screen.
 *
 * Day 4 will add `GET /aiq/v1/submissions` (list + single) with API-key auth.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AIQ_API {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	public function register_routes() {
		register_rest_route( 'aiq/v1', '/submit', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_submission' ),
			'permission_callback' => '__return_true',
		) );

		register_rest_route( 'aiq/v1', '/_admin/backfill-batch', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_backfill_batch' ),
			'permission_callback' => array( $this, 'admin_permission_check' ),
		) );

		register_rest_route( 'aiq/v1', '/_admin/backfill-status', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'handle_backfill_status' ),
			'permission_callback' => array( $this, 'admin_permission_check' ),
		) );
	}

	public function admin_permission_check() {
		return current_user_can( 'manage_options' );
	}

	public function handle_submission( $request ) {
		$params = $request->get_json_params();

		if ( empty( $params['answers'] ) ) {
			return new WP_Error( 'no_data', 'Missing answers data', array( 'status' => 400 ) );
		}

		$answers = $params['answers'];
		$result  = isset( $params['result'] ) && is_array( $params['result'] ) ? $params['result'] : array();
		$lead    = isset( $params['lead'] ) && is_array( $params['lead'] ) ? $params['lead'] : array();
		$tp      = isset( $params['threatProfile'] ) && is_array( $params['threatProfile'] ) ? $params['threatProfile'] : array();
		$recs    = isset( $params['recommendations'] ) ? $params['recommendations'] : null;

		$email = isset( $lead['email'] ) ? sanitize_email( $lead['email'] )
			: ( isset( $params['email'] ) ? sanitize_email( $params['email'] ) : '' );

		// Legacy CPT write — preserves the existing wp-admin "Assessments"
		// list view that staff already use. Keep this path working
		// regardless of what happens with the new table.
		$post_title = 'Assessment - ' . current_time( 'Y-m-d H:i:s' );
		if ( ! empty( $email ) ) {
			$post_title .= ' - ' . $email;
		}

		$cpt_post_id = wp_insert_post( array(
			'post_type'   => 'aiq_submission',
			'post_status' => 'publish',
			'post_title'  => $post_title,
		) );

		if ( is_wp_error( $cpt_post_id ) ) {
			return $cpt_post_id;
		}

		update_post_meta( $cpt_post_id, '_aiq_answers', $answers );
		update_post_meta( $cpt_post_id, '_aiq_scores', $result );
		update_post_meta( $cpt_post_id, '_aiq_ip', isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '' );

		// New structured-table write (best-effort — never blocks the user).
		$table_row = array(
			'cpt_post_id'    => $cpt_post_id,
			'email'          => $email,
			'first_name'     => isset( $lead['firstName'] ) ? $lead['firstName'] : '',
			'last_name'      => isset( $lead['lastName'] ) ? $lead['lastName'] : '',
			'company'        => isset( $lead['company'] ) ? $lead['company'] : '',
			'sector'         => isset( $tp['sector'] ) ? $tp['sector'] : '',
			'region'         => isset( $tp['region'] ) ? $tp['region'] : '',
			'revenue_band'   => isset( $tp['revenueBand'] ) ? $tp['revenueBand'] : '',
			'headcount_band' => isset( $tp['headcountBand'] ) ? $tp['headcountBand'] : '',
			'regulatory_json'       => isset( $tp['regulatory'] ) ? $tp['regulatory'] : null,
			'data_sensitivity_json' => isset( $tp['dataSensitivity'] ) ? $tp['dataSensitivity'] : null,
			'overall_score'  => isset( $result['overallScore'] ) ? $result['overallScore'] : null,
			'cti_score'      => isset( $result['ctiScore'] ) ? $result['ctiScore'] : null,
			'dm_score'       => isset( $result['dmScore'] ) ? $result['dmScore'] : null,
			'te_score'       => isset( $result['teScore'] ) ? $result['teScore'] : null,
			'ctem_score'     => isset( $result['ctemScore'] ) ? $result['ctemScore'] : null,
			'ctem_skipped'   => ! empty( $result['ctemSkipped'] ),
			'maturity_level' => isset( $result['maturityLevel'] ) ? $result['maturityLevel'] : null,
			'answers'        => $answers,
			'recommendations' => $recs,
			'threat_profile' => $tp,
			'ip'             => isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '',
			'user_agent'     => isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '',
		);

		$submission_id = AIQ_DB::insert_submission( $table_row );

		$response = array(
			'success' => true,
			'id'      => $cpt_post_id,
			'message' => 'Assessment saved successfully',
		);

		if ( ! is_wp_error( $submission_id ) ) {
			$response['submission_id'] = $submission_id;
		} else {
			// Don't surface the DB error to the public submit response;
			// it's already in the error log option for the admin.
			$response['warning'] = 'Submission saved to legacy storage only';
		}

		return rest_ensure_response( $response );
	}

	public function handle_backfill_batch( $request ) {
		$result = AIQ_Migrate::run_batch();
		return rest_ensure_response( $result );
	}

	public function handle_backfill_status( $request ) {
		return rest_ensure_response( array(
			'progress'        => AIQ_Migrate::get_progress(),
			'cpt_count'       => AIQ_DB::count_cpt_posts(),
			'table_count'     => AIQ_DB::count_rows(),
		) );
	}
}

new AIQ_API();

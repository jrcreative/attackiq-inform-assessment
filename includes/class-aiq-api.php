<?php

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
			'permission_callback' => array( $this, 'submission_permission_check' ),
		) );

		register_rest_route( 'aiq/v1', '/submissions', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'handle_list_submissions' ),
			'permission_callback' => array( 'AIQ_Auth', 'rest_permission' ),
		) );

		register_rest_route( 'aiq/v1', '/submissions/(?P<id>\d+)', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'handle_get_submission' ),
			'permission_callback' => array( 'AIQ_Auth', 'rest_permission' ),
			'args'                => array(
				'id' => array(
					'validate_callback' => function( $value ) {
						return is_numeric( $value ) && intval( $value ) > 0;
					},
				),
			),
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

	public function submission_permission_check( $request ) {
		$nonce = $request->get_header( 'x_wp_nonce' );
		if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error( 'aiq_submission_nonce_invalid', 'Invalid submission nonce', array( 'status' => 403 ) );
		}
		return true;
	}

	public function handle_submission( $request ) {
		$params = $request->get_json_params();

		if ( empty( $params['answers'] ) ) {
			return new WP_Error( 'no_data', 'Missing answers data', array( 'status' => 400 ) );
		}

		$answers = is_array( $params['answers'] ) ? $params['answers'] : array();
		$result  = isset( $params['result'] ) && is_array( $params['result'] ) ? $params['result'] : array();
		$lead    = isset( $params['lead'] ) && is_array( $params['lead'] ) ? $params['lead'] : array();
		$tp      = isset( $params['threatProfile'] ) && is_array( $params['threatProfile'] ) ? $params['threatProfile'] : array();
		$recs    = isset( $params['recommendations'] ) ? $params['recommendations'] : null;

		$email = isset( $lead['email'] ) ? sanitize_email( $lead['email'] )
			: ( isset( $params['email'] ) ? sanitize_email( $params['email'] ) : '' );

		$post_title = 'Assessment - ' . current_time( 'Y-m-d H:i:s' );
		if ( ! empty( $email ) ) {
			$post_title .= ' - ' . $email;
		}

		$cpt_post_id = wp_insert_post( array(
			'post_type'   => 'aiq_submission',
			'post_status' => 'publish',
			'post_title'  => sanitize_text_field( $post_title ),
		) );

		if ( is_wp_error( $cpt_post_id ) ) {
			return $cpt_post_id;
		}

		update_post_meta( $cpt_post_id, '_aiq_answers', $this->sanitize_recursive( $answers ) );
		update_post_meta( $cpt_post_id, '_aiq_scores', $this->sanitize_recursive( $result ) );
		update_post_meta( $cpt_post_id, '_aiq_ip', isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '' );

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
			'answers'        => $this->sanitize_recursive( $answers ),
			'recommendations' => $this->sanitize_recursive( $recs ),
			'threat_profile' => $this->sanitize_recursive( $tp ),
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

			$response['warning'] = 'Submission saved to legacy storage only';
		}

		return rest_ensure_response( $response );
	}

	public function handle_list_submissions( $request ) {
		$args = array(
			'date_from'    => $request->get_param( 'date_from' ),
			'date_to'      => $request->get_param( 'date_to' ),
			'min_score'    => $request->get_param( 'min_score' ),
			'max_score'    => $request->get_param( 'max_score' ),
			'sector'       => $request->get_param( 'sector' ),
			'email'        => $request->get_param( 'email' ),
			'ctem_skipped' => $request->get_param( 'ctem_skipped' ),
			'page'         => $request->get_param( 'page' ) ?: 1,
			'per_page'     => $request->get_param( 'per_page' ) ?: 25,
			'orderby'      => $request->get_param( 'orderby' ) ?: 'created_at',
			'order'        => $request->get_param( 'order' ) ?: 'DESC',
		);

		foreach ( array( 'min_score', 'max_score', 'ctem_skipped' ) as $k ) {
			if ( '' === $args[ $k ] || null === $args[ $k ] ) {
				$args[ $k ] = null;
			}
		}

		$result = AIQ_DB::query_submissions( $args );

		$shaped = array_map( array( $this, 'shape_list_row' ), $result['rows'] );

		$response = rest_ensure_response( $shaped );
		$per_page = max( 1, min( 100, intval( $args['per_page'] ) ) );
		$response->header( 'X-WP-Total', (string) $result['total'] );
		$response->header( 'X-WP-TotalPages', (string) max( 1, (int) ceil( $result['total'] / $per_page ) ) );

		return $response;
	}

	private function shape_list_row( array $row ) {
		return array(
			'id'             => intval( $row['id'] ),
			'created_at'     => $row['created_at'],
			'email'          => $row['email'],
			'first_name'     => $row['first_name'],
			'last_name'      => $row['last_name'],
			'company'        => $row['company'],
			'sector'         => $row['sector'],
			'region'         => $row['region'],
			'revenue_band'   => $row['revenue_band'],
			'headcount_band' => $row['headcount_band'],
			'regulatory'     => $this->maybe_decode( $row['regulatory_json'] ),
			'data_sensitivity' => $this->maybe_decode( $row['data_sensitivity_json'] ),
			'overall_score'  => null !== $row['overall_score'] ? floatval( $row['overall_score'] ) : null,
			'cti_score'      => null !== $row['cti_score'] ? intval( $row['cti_score'] ) : null,
			'dm_score'       => null !== $row['dm_score'] ? intval( $row['dm_score'] ) : null,
			'te_score'       => null !== $row['te_score'] ? intval( $row['te_score'] ) : null,
			'ctem_score'     => null !== $row['ctem_score'] ? intval( $row['ctem_score'] ) : null,
			'ctem_skipped'   => (bool) $row['ctem_skipped'],
			'maturity_level' => null !== $row['maturity_level'] ? intval( $row['maturity_level'] ) : null,
		);
	}

	public function handle_get_submission( $request ) {
		$id  = intval( $request['id'] );
		$row = AIQ_DB::get_submission( $id );

		if ( ! $row ) {
			return new WP_Error( 'aiq_submission_not_found', 'Submission not found', array( 'status' => 404 ) );
		}

		$response = array(
			'id'             => intval( $row['id'] ),
			'created_at'     => $row['created_at'],
			'cpt_post_id'    => $row['cpt_post_id'] ? intval( $row['cpt_post_id'] ) : null,
			'email'          => $row['email'],
			'first_name'     => $row['first_name'],
			'last_name'      => $row['last_name'],
			'company'        => $row['company'],
			'sector'         => $row['sector'],
			'region'         => $row['region'],
			'revenue_band'   => $row['revenue_band'],
			'headcount_band' => $row['headcount_band'],
			'regulatory'     => $this->maybe_decode( $row['regulatory_json'] ),
			'data_sensitivity' => $this->maybe_decode( $row['data_sensitivity_json'] ),
			'overall_score'  => null !== $row['overall_score'] ? floatval( $row['overall_score'] ) : null,
			'cti_score'      => null !== $row['cti_score'] ? intval( $row['cti_score'] ) : null,
			'dm_score'       => null !== $row['dm_score'] ? intval( $row['dm_score'] ) : null,
			'te_score'       => null !== $row['te_score'] ? intval( $row['te_score'] ) : null,
			'ctem_score'     => null !== $row['ctem_score'] ? intval( $row['ctem_score'] ) : null,
			'ctem_skipped'   => (bool) $row['ctem_skipped'],
			'maturity_level' => null !== $row['maturity_level'] ? intval( $row['maturity_level'] ) : null,
			'answers'        => $this->maybe_decode( $row['answers_json'] ),
			'recommendations' => $this->maybe_decode( $row['recommendations_json'] ),
			'threat_profile' => $this->maybe_decode( $row['threat_profile_json'] ),
			'ip'             => $row['ip'],
			'user_agent'     => $row['user_agent'],
		);

		return rest_ensure_response( $response );
	}

	private function maybe_decode( $json ) {
		if ( empty( $json ) ) {
			return null;
		}
		$decoded = json_decode( $json, true );
		return ( JSON_ERROR_NONE === json_last_error() ) ? $decoded : null;
	}

	private function sanitize_recursive( $value ) {
		if ( is_array( $value ) ) {
			$clean = array();
			foreach ( $value as $key => $item ) {
				$clean[ is_string( $key ) ? sanitize_text_field( $key ) : $key ] = $this->sanitize_recursive( $item );
			}
			return $clean;
		}
		if ( is_string( $value ) ) {
			return sanitize_textarea_field( $value );
		}
		if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) || null === $value ) {
			return $value;
		}
		return sanitize_text_field( (string) $value );
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

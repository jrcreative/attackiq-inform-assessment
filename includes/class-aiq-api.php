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
			'methods'  => 'POST',
			'callback' => array( $this, 'handle_submission' ),
			'permission_callback' => '__return_true',
		) );
	}

	public function handle_submission( $request ) {
		$params = $request->get_json_params();

        if ( empty( $params['answers'] ) ) {
            return new WP_Error( 'no_data', 'Missing answers data', array( 'status' => 400 ) );
        }

        $post_title = 'Assessment - ' . current_time( 'Y-m-d H:i:s' );
        if ( ! empty( $params['email'] ) ) {
            $post_title .= ' - ' . sanitize_email( $params['email'] );
        }

        $post_id = wp_insert_post( array(
            'post_type'   => 'aiq_submission',
            'post_status' => 'publish',
            'post_title'  => $post_title,
        ) );

        if ( is_wp_error( $post_id ) ) {
            return $post_id;
        }

        update_post_meta( $post_id, '_aiq_answers', $params['answers'] );
        update_post_meta( $post_id, '_aiq_scores', $params['result'] );
        
        update_post_meta( $post_id, '_aiq_ip', $_SERVER['REMOTE_ADDR'] );

		return rest_ensure_response( array(
            'success' => true,
            'id' => $post_id,
            'message' => 'Assessment saved successfully'
        ) );
	}
}

new AIQ_API();

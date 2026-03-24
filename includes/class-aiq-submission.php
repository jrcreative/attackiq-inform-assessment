<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AIQ_Submission {
	public function __construct() {
		add_action( 'init', array( $this, 'register_post_type' ) );
	}

	public function register_post_type() {
		$args = array(
			'public'    => false,
			'show_ui'   => true,
			'label'     => 'Assessments',
			'supports'  => array( 'title', 'custom-fields' ),
			'menu_icon' => 'dashicons-chart-bar',
            'capabilities' => array(
                'create_posts' => 'do_not_allow',
            ),
            'map_meta_cap' => true,
		);
		register_post_type( 'aiq_submission', $args );
	}
}
new AIQ_Submission();

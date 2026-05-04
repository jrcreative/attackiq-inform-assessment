<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once plugin_dir_path( __FILE__ ) . 'includes/class-aiq-db.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-aiq-submission.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-aiq-api.php';

// Run dbDelta on activation. The maybe_upgrade() call inside init also catches
// existing live installs whose schema version is missing or stale.
register_activation_hook( __FILE__, array( 'AIQ_DB', 'install' ) );

class AIQ_Inform_Assessment {

	private $default_marketo_form_id = '';
	private $default_marketo_instance = 'app-ab33.marketo.com';
	private $default_munchkin_id = '041-FSQ-281';

	public function __construct() {
		add_action( 'init', array( $this, 'register_scripts' ) );
		add_action( 'init', array( 'AIQ_DB', 'maybe_upgrade' ) );
		add_shortcode( 'inform_assessment', array( $this, 'render_shortcode' ) );
		add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
	}

	public function register_scripts() {
        if ( ! file_exists( plugin_dir_path( __FILE__ ) . 'build/index.asset.php' ) ) {
            return;
        }

		$asset_file = include( plugin_dir_path( __FILE__ ) . 'build/index.asset.php' );

		wp_register_script(
			'aiq-inform-assessment',
			plugins_url( 'build/index.js', __FILE__ ),
			$asset_file['dependencies'],
			$asset_file['version'],
			true
		);

        wp_register_style(
            'aiq-inform-assessment-style',
            plugins_url( 'build/style-index.css', __FILE__ ),
            array(),
            $asset_file['version']
        );
	}

	public function render_shortcode( $atts ) {
		$atts = shortcode_atts( array(
			'marketo_form_id' => get_option( 'aiq_marketo_form_id', $this->default_marketo_form_id ),
			'marketo_instance' => get_option( 'aiq_marketo_instance', $this->default_marketo_instance ),
			'munchkin_id' => get_option( 'aiq_munchkin_id', $this->default_munchkin_id ),
			'gate_downloads' => get_option( 'aiq_gate_downloads', 'yes' ),
		), $atts, 'inform_assessment' );

		wp_enqueue_script( 'aiq-inform-assessment' );
        wp_enqueue_style( 'aiq-inform-assessment-style' );

		wp_localize_script( 'aiq-inform-assessment', 'aiqInformData', array(
            'root_id' => 'aiq-inform-assessment-root',
            'ajax_url' => admin_url( 'admin-ajax.php' ),
			'rest_url' => rest_url( 'aiq/v1/' ),
			'nonce' => wp_create_nonce( 'wp_rest' ),
			'siteUrl' => site_url(),
			'pluginUrl' => plugin_dir_url( __FILE__ ),
			'marketo' => array(
				'formId' => sanitize_text_field( $atts['marketo_form_id'] ),
				'instance' => sanitize_text_field( $atts['marketo_instance'] ),
				'munchkinId' => sanitize_text_field( $atts['munchkin_id'] ),
				'gateDownloads' => $atts['gate_downloads'] === 'yes' && ! empty( $atts['marketo_form_id'] ),
			),
			'contactUrl' => esc_url( get_option( 'aiq_contact_url', '' ) ),
			'contactButtonText' => sanitize_text_field( get_option( 'aiq_contact_button_text', 'Improve Your Score' ) ),
        ));

		return '<div id="aiq-inform-assessment-root">Loading Assessment...</div>';
	}

	public function add_settings_page() {
		add_options_page(
			__( 'INFORM Assessment Settings', 'attackiq-inform-assessment' ),
			__( 'INFORM Assessment', 'attackiq-inform-assessment' ),
			'manage_options',
			'aiq-inform-assessment-settings',
			array( $this, 'render_settings_page' )
		);
	}

	public function register_settings() {
		register_setting( 'aiq_inform_assessment_settings', 'aiq_marketo_form_id', 'sanitize_text_field' );
		register_setting( 'aiq_inform_assessment_settings', 'aiq_marketo_instance', 'sanitize_text_field' );
		register_setting( 'aiq_inform_assessment_settings', 'aiq_munchkin_id', 'sanitize_text_field' );
		register_setting( 'aiq_inform_assessment_settings', 'aiq_gate_downloads', 'sanitize_text_field' );
		register_setting( 'aiq_inform_assessment_settings', 'aiq_contact_url', 'esc_url_raw' );
		register_setting( 'aiq_inform_assessment_settings', 'aiq_contact_button_text', 'sanitize_text_field' );

		add_settings_section(
			'aiq_marketo_section',
			__( 'Marketo Integration', 'attackiq-inform-assessment' ),
			array( $this, 'render_marketo_section' ),
			'aiq-inform-assessment-settings'
		);

		add_settings_field(
			'aiq_marketo_form_id',
			__( 'Marketo Form ID', 'attackiq-inform-assessment' ),
			array( $this, 'render_form_id_field' ),
			'aiq-inform-assessment-settings',
			'aiq_marketo_section'
		);

		add_settings_field(
			'aiq_marketo_instance',
			__( 'Marketo Instance', 'attackiq-inform-assessment' ),
			array( $this, 'render_instance_field' ),
			'aiq-inform-assessment-settings',
			'aiq_marketo_section'
		);

		add_settings_field(
			'aiq_munchkin_id',
			__( 'Munchkin ID', 'attackiq-inform-assessment' ),
			array( $this, 'render_munchkin_field' ),
			'aiq-inform-assessment-settings',
			'aiq_marketo_section'
		);

		add_settings_field(
			'aiq_gate_downloads',
			__( 'Gate Downloads', 'attackiq-inform-assessment' ),
			array( $this, 'render_gate_field' ),
			'aiq-inform-assessment-settings',
			'aiq_marketo_section'
		);

		add_settings_section(
			'aiq_cta_section',
			__( 'Call to Action Settings', 'attackiq-inform-assessment' ),
			array( $this, 'render_cta_section' ),
			'aiq-inform-assessment-settings'
		);

		add_settings_field(
			'aiq_contact_url',
			__( 'Contact Page URL', 'attackiq-inform-assessment' ),
			array( $this, 'render_contact_url_field' ),
			'aiq-inform-assessment-settings',
			'aiq_cta_section'
		);

		add_settings_field(
			'aiq_contact_button_text',
			__( 'Contact Button Text', 'attackiq-inform-assessment' ),
			array( $this, 'render_contact_button_field' ),
			'aiq-inform-assessment-settings',
			'aiq_cta_section'
		);
	}

	public function render_marketo_section() {
		echo '<p>' . esc_html__( 'Configure Marketo form integration for gating PDF/JSON downloads.', 'attackiq-inform-assessment' ) . '</p>';
	}

	public function render_cta_section() {
		echo '<p>' . esc_html__( 'Configure the "Contact Us" call-to-action button on results page.', 'attackiq-inform-assessment' ) . '</p>';
	}

	public function render_form_id_field() {
		$value = get_option( 'aiq_marketo_form_id', '' );
		echo '<input type="text" name="aiq_marketo_form_id" value="' . esc_attr( $value ) . '" class="regular-text" placeholder="e.g., 1234" />';
		echo '<p class="description">' . esc_html__( 'The Marketo Form ID. Find this in your Marketo admin under Marketing Activities > Forms.', 'attackiq-inform-assessment' ) . '</p>';
	}

	public function render_instance_field() {
		$value = get_option( 'aiq_marketo_instance', $this->default_marketo_instance );
		echo '<input type="text" name="aiq_marketo_instance" value="' . esc_attr( $value ) . '" class="regular-text" />';
		echo '<p class="description">' . esc_html__( 'Your Marketo instance URL (e.g., app-ab33.marketo.com)', 'attackiq-inform-assessment' ) . '</p>';
	}

	public function render_munchkin_field() {
		$value = get_option( 'aiq_munchkin_id', $this->default_munchkin_id );
		echo '<input type="text" name="aiq_munchkin_id" value="' . esc_attr( $value ) . '" class="regular-text" />';
		echo '<p class="description">' . esc_html__( 'Your Marketo Munchkin ID (e.g., 041-FSQ-281)', 'attackiq-inform-assessment' ) . '</p>';
	}

	public function render_gate_field() {
		$value = get_option( 'aiq_gate_downloads', 'yes' );
		echo '<label><input type="checkbox" name="aiq_gate_downloads" value="yes" ' . checked( $value, 'yes', false ) . ' /> ';
		echo esc_html__( 'Require Marketo form submission before PDF/JSON download', 'attackiq-inform-assessment' ) . '</label>';
		echo '<p class="description">' . esc_html__( 'When enabled, users must fill out the Marketo form to download their results.', 'attackiq-inform-assessment' ) . '</p>';
	}

	public function render_contact_url_field() {
		$value = get_option( 'aiq_contact_url', '' );
		echo '<input type="url" name="aiq_contact_url" value="' . esc_attr( $value ) . '" class="regular-text" placeholder="https://attackiq.com/contact" />';
		echo '<p class="description">' . esc_html__( 'URL for the "Contact Us" button on the results page.', 'attackiq-inform-assessment' ) . '</p>';
	}

	public function render_contact_button_field() {
		$value = get_option( 'aiq_contact_button_text', 'Improve Your Score' );
		echo '<input type="text" name="aiq_contact_button_text" value="' . esc_attr( $value ) . '" class="regular-text" />';
		echo '<p class="description">' . esc_html__( 'Text for the call-to-action button (e.g., "Contact Us", "Improve Your Score", "Get Expert Help").', 'attackiq-inform-assessment' ) . '</p>';
	}

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<form action="options.php" method="post">
				<?php
				settings_fields( 'aiq_inform_assessment_settings' );
				do_settings_sections( 'aiq-inform-assessment-settings' );
				submit_button();
				?>
			</form>

			<hr />
			<h2><?php esc_html_e( 'Shortcode Usage', 'attackiq-inform-assessment' ); ?></h2>
			<p><?php esc_html_e( 'Use the following shortcode to display the assessment:', 'attackiq-inform-assessment' ); ?></p>
			<code>[inform_assessment]</code>

			<p><?php esc_html_e( 'You can also override settings per shortcode:', 'attackiq-inform-assessment' ); ?></p>
			<code>[inform_assessment marketo_form_id="1234" gate_downloads="yes"]</code>
		</div>
		<?php
	}
}

new AIQ_Inform_Assessment();

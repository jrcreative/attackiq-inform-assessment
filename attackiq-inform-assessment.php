<?php
/**
 * Plugin Name: AttackIQ Inform Assessment
 * Description: Interactive Inform Assessment tool built with React.
 * Version: 1.2.0
 * Author: Volume11
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once plugin_dir_path( __FILE__ ) . 'includes/class-aiq-db.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-aiq-migrate.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-aiq-auth.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-aiq-submission.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-aiq-api.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-aiq-admin-list.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-aiq-admin.php';

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
		add_action( 'admin_post_aiq_generate_api_key', array( $this, 'handle_generate_api_key' ) );
		add_action( 'admin_post_aiq_revoke_api_key', array( $this, 'handle_revoke_api_key' ) );
	}

	public function handle_generate_api_key() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( __( 'Insufficient permissions', 'attackiq-inform-assessment' ) );
		}
		check_admin_referer( 'aiq_generate_api_key' );
		AIQ_Auth::generate_and_store();
		wp_safe_redirect( admin_url( 'admin.php?page=aiq-inform-assessment-settings&aiq_key_generated=1' ) );
		exit;
	}

	public function handle_revoke_api_key() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( __( 'Insufficient permissions', 'attackiq-inform-assessment' ) );
		}
		check_admin_referer( 'aiq_revoke_api_key' );
		AIQ_Auth::revoke();
		wp_safe_redirect( admin_url( 'admin.php?page=aiq-inform-assessment-settings&aiq_key_revoked=1' ) );
		exit;
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
		add_submenu_page(
			'aiq-submissions',
			__( 'INFORM Assessment Settings', 'attackiq-inform-assessment' ),
			__( 'Settings', 'attackiq-inform-assessment' ),
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

		$cpt_count   = AIQ_DB::count_cpt_posts();
		$table_count = AIQ_DB::count_rows();
		$progress    = AIQ_Migrate::get_progress();
		$nonce       = wp_create_nonce( 'wp_rest' );
		$rest_url    = esc_url_raw( rest_url( 'aiq/v1/' ) );
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
			<h2><?php esc_html_e( 'Database & Backfill', 'attackiq-inform-assessment' ); ?></h2>
			<p><?php esc_html_e( 'New submissions write to a dedicated database table for faster reporting and Salesforce hand-off. Existing submissions stored on the legacy custom post type can be backfilled into the new table on demand.', 'attackiq-inform-assessment' ); ?></p>

			<table class="widefat striped" style="max-width:520px;margin-bottom:20px;">
				<tbody>
					<tr><th><?php esc_html_e( 'Submissions in legacy CPT', 'attackiq-inform-assessment' ); ?></th><td id="aiq-cpt-count"><?php echo esc_html( $cpt_count ); ?></td></tr>
					<tr><th><?php esc_html_e( 'Submissions in new table', 'attackiq-inform-assessment' ); ?></th><td id="aiq-table-count"><?php echo esc_html( $table_count ); ?></td></tr>
					<tr><th><?php esc_html_e( 'Backfill last run', 'attackiq-inform-assessment' ); ?></th><td><?php echo $progress['completed_at'] ? esc_html( $progress['completed_at'] ) . ' (UTC)' : esc_html__( 'Not run', 'attackiq-inform-assessment' ); ?></td></tr>
				</tbody>
			</table>

			<button type="button" id="aiq-backfill-run" class="button button-primary"><?php esc_html_e( 'Run Backfill', 'attackiq-inform-assessment' ); ?></button>
			<span id="aiq-backfill-status" style="margin-left:12px;"></span>

			<script>
			(function(){
				var btn = document.getElementById('aiq-backfill-run');
				var statusEl = document.getElementById('aiq-backfill-status');
				var tableCountEl = document.getElementById('aiq-table-count');
				if (!btn) return;

				var endpoint = <?php echo wp_json_encode( $rest_url ); ?> + '_admin/backfill-batch';
				var nonce    = <?php echo wp_json_encode( $nonce ); ?>;

				function runBatch(){
					statusEl.textContent = '<?php echo esc_js( __( 'Running…', 'attackiq-inform-assessment' ) ); ?>';
					fetch(endpoint, {
						method: 'POST',
						credentials: 'same-origin',
						headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce }
					}).then(function(r){ return r.json(); }).then(function(data){
						if (data.error) {
							statusEl.textContent = 'Error: ' + data.error;
							btn.disabled = false;
							return;
						}
						tableCountEl.textContent = data.migrated;
						statusEl.textContent = data.migrated + ' migrated · ' + data.skipped + ' skipped · ' + data.remaining + ' remaining';
						if (data.done) {
							btn.disabled = false;
						} else {
							setTimeout(runBatch, 100);
						}
					}).catch(function(err){
						statusEl.textContent = 'Error: ' + err.message;
						btn.disabled = false;
					});
				}

				btn.addEventListener('click', function(){
					btn.disabled = true;
					runBatch();
				});
			})();
			</script>

			<hr />
			<h2><?php esc_html_e( 'External REST API', 'attackiq-inform-assessment' ); ?></h2>
			<p><?php esc_html_e( 'Generate an API key so external tools can pull submission data via the read API. The key is shown once at generation time and stored as a hash — keep it somewhere safe.', 'attackiq-inform-assessment' ); ?></p>

			<?php
			$flash_key = AIQ_Auth::consume_flash();
			if ( $flash_key ) :
				?>
				<div class="notice notice-success" style="padding:12px;">
					<p><strong><?php esc_html_e( 'Your new API key (shown once):', 'attackiq-inform-assessment' ); ?></strong></p>
					<input type="text" readonly value="<?php echo esc_attr( $flash_key ); ?>" style="width:100%;max-width:520px;font-family:monospace;" onclick="this.select();" />
					<p class="description"><?php esc_html_e( 'Copy this value now. After leaving this page only the prefix is recoverable.', 'attackiq-inform-assessment' ); ?></p>
				</div>
				<?php
			endif;
			?>

			<table class="widefat striped" style="max-width:520px;margin-bottom:20px;">
				<tbody>
					<tr><th><?php esc_html_e( 'Status', 'attackiq-inform-assessment' ); ?></th><td><?php echo AIQ_Auth::has_key() ? esc_html__( 'Active', 'attackiq-inform-assessment' ) : esc_html__( 'No key generated', 'attackiq-inform-assessment' ); ?></td></tr>
					<tr><th><?php esc_html_e( 'Key prefix', 'attackiq-inform-assessment' ); ?></th><td><?php echo AIQ_Auth::has_key() ? '<code>' . esc_html( AIQ_Auth::get_key_prefix() ) . '…</code>' : '—'; ?></td></tr>
					<tr><th><?php esc_html_e( 'Created', 'attackiq-inform-assessment' ); ?></th><td><?php echo AIQ_Auth::has_key() ? esc_html( AIQ_Auth::get_created_at() ) . ' (UTC)' : '—'; ?></td></tr>
					<tr><th><?php esc_html_e( 'Auth header', 'attackiq-inform-assessment' ); ?></th><td><code>X-AIQ-Key: &lt;your-key&gt;</code></td></tr>
				</tbody>
			</table>

			<form action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" method="post" style="display:inline-block;margin-right:10px;">
				<input type="hidden" name="action" value="aiq_generate_api_key" />
				<?php wp_nonce_field( 'aiq_generate_api_key' ); ?>
				<button type="submit" class="button button-primary">
					<?php echo AIQ_Auth::has_key() ? esc_html__( 'Regenerate Key', 'attackiq-inform-assessment' ) : esc_html__( 'Generate New Key', 'attackiq-inform-assessment' ); ?>
				</button>
			</form>

			<?php if ( AIQ_Auth::has_key() ) : ?>
				<form action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" method="post" style="display:inline-block;" onsubmit="return confirm('<?php echo esc_js( __( 'Revoke the current API key? Existing integrations will stop working until a new key is issued.', 'attackiq-inform-assessment' ) ); ?>');">
					<input type="hidden" name="action" value="aiq_revoke_api_key" />
					<?php wp_nonce_field( 'aiq_revoke_api_key' ); ?>
					<button type="submit" class="button"><?php esc_html_e( 'Revoke Key', 'attackiq-inform-assessment' ); ?></button>
				</form>
			<?php endif; ?>

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

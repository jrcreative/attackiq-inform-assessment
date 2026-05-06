<?php
/**
 * Phase 2 — Admin shell for the Submissions list UI, CSV export, and the
 * per-row View JSON modal. Reuses AIQ_DB::query_submissions() for filtering
 * and the Day 4 GET /aiq/v1/submissions/{id} endpoint (admin bypass) for
 * the modal's payload.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AIQ_Admin {

	const MENU_SLUG = 'aiq-submissions';

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
	}

	public function register_menu() {
		add_menu_page(
			__( 'INFORM Submissions', 'attackiq-inform-assessment' ),
			__( 'AttackIQ INFORM', 'attackiq-inform-assessment' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_list_page' ),
			'dashicons-chart-bar',
			30
		);
	}

	public function render_list_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( __( 'Insufficient permissions', 'attackiq-inform-assessment' ) );
		}

		$table = new AIQ_Admin_List_Table();
		$table->prepare_items();

		$sectors = self::distinct_sectors();
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'INFORM Submissions', 'attackiq-inform-assessment' ); ?></h1>

			<form method="get" style="margin-top:12px;margin-bottom:6px;">
				<input type="hidden" name="page" value="<?php echo esc_attr( self::MENU_SLUG ); ?>" />

				<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:10px;">
					<label><?php esc_html_e( 'From', 'attackiq-inform-assessment' ); ?><br />
						<input type="date" name="date_from" value="<?php echo esc_attr( $_GET['date_from'] ?? '' ); ?>" />
					</label>
					<label><?php esc_html_e( 'To', 'attackiq-inform-assessment' ); ?><br />
						<input type="date" name="date_to" value="<?php echo esc_attr( $_GET['date_to'] ?? '' ); ?>" />
					</label>
					<label><?php esc_html_e( 'Sector', 'attackiq-inform-assessment' ); ?><br />
						<select name="sector">
							<option value=""><?php esc_html_e( 'All sectors', 'attackiq-inform-assessment' ); ?></option>
							<?php foreach ( $sectors as $s ) : ?>
								<option value="<?php echo esc_attr( $s ); ?>" <?php selected( ( $_GET['sector'] ?? '' ), $s ); ?>><?php echo esc_html( $s ); ?></option>
							<?php endforeach; ?>
						</select>
					</label>
					<label><?php esc_html_e( 'Min score', 'attackiq-inform-assessment' ); ?><br />
						<input type="number" step="0.01" min="0" max="1" name="min_score" value="<?php echo esc_attr( $_GET['min_score'] ?? '' ); ?>" style="width:80px;" />
					</label>
					<label><?php esc_html_e( 'Max score', 'attackiq-inform-assessment' ); ?><br />
						<input type="number" step="0.01" min="0" max="1" name="max_score" value="<?php echo esc_attr( $_GET['max_score'] ?? '' ); ?>" style="width:80px;" />
					</label>
					<label><?php esc_html_e( 'CTEM', 'attackiq-inform-assessment' ); ?><br />
						<select name="ctem_skipped">
							<option value=""><?php esc_html_e( 'Any', 'attackiq-inform-assessment' ); ?></option>
							<option value="0" <?php selected( ( $_GET['ctem_skipped'] ?? '' ), '0' ); ?>><?php esc_html_e( 'Included only', 'attackiq-inform-assessment' ); ?></option>
							<option value="1" <?php selected( ( $_GET['ctem_skipped'] ?? '' ), '1' ); ?>><?php esc_html_e( 'Skipped only', 'attackiq-inform-assessment' ); ?></option>
						</select>
					</label>
					<label><?php esc_html_e( 'Search email / company', 'attackiq-inform-assessment' ); ?><br />
						<input type="search" name="s" value="<?php echo esc_attr( $_GET['s'] ?? '' ); ?>" />
					</label>
					<button class="button button-primary" type="submit"><?php esc_html_e( 'Filter', 'attackiq-inform-assessment' ); ?></button>
					<a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=' . self::MENU_SLUG ) ); ?>"><?php esc_html_e( 'Reset', 'attackiq-inform-assessment' ); ?></a>
				</div>
			</form>

			<?php $table->display(); ?>
		</div>
		<?php
	}

	private static function distinct_sectors() {
		global $wpdb;
		$tbl = AIQ_DB::get_table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_col( "SELECT DISTINCT sector FROM {$tbl} WHERE sector IS NOT NULL AND sector != '' ORDER BY sector ASC" );
		return is_array( $rows ) ? $rows : array();
	}
}

new AIQ_Admin();

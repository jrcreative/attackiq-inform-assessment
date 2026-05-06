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
		add_action( 'admin_post_aiq_export_csv', array( $this, 'handle_export_csv' ) );
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
					<a class="button" href="<?php echo esc_url( self::build_export_url() ); ?>"><?php esc_html_e( 'Export CSV', 'attackiq-inform-assessment' ); ?></a>
				</div>
			</form>

			<?php $table->display(); ?>

			<?php $this->render_view_json_modal(); ?>
		</div>
		<?php
	}

	private function render_view_json_modal() {
		$rest_url = esc_url_raw( rest_url( 'aiq/v1/submissions/' ) );
		$nonce    = wp_create_nonce( 'wp_rest' );
		?>
		<div id="aiq-json-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100000;">
			<div style="background:#fff;max-width:920px;width:92%;max-height:88vh;margin:4vh auto;border-radius:6px;display:flex;flex-direction:column;overflow:hidden;">
				<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #ddd;background:#f7f7f7;">
					<h2 id="aiq-json-modal-title" style="margin:0;font-size:16px;">Submission</h2>
					<div>
						<button type="button" class="button" id="aiq-json-modal-copy"><?php esc_html_e( 'Copy JSON', 'attackiq-inform-assessment' ); ?></button>
						<button type="button" class="button" id="aiq-json-modal-close" style="margin-left:6px;"><?php esc_html_e( 'Close', 'attackiq-inform-assessment' ); ?></button>
					</div>
				</div>
				<div style="padding:14px 18px;overflow:auto;">
					<div id="aiq-json-modal-summary" style="margin-bottom:12px;font-size:13px;color:#444;"></div>
					<pre id="aiq-json-modal-body" style="background:#0e1116;color:#e6edf3;padding:14px;border-radius:4px;font-size:12px;line-height:1.5;overflow:auto;max-height:65vh;"></pre>
				</div>
			</div>
		</div>
		<script>
		(function(){
			var modal   = document.getElementById('aiq-json-modal');
			var title   = document.getElementById('aiq-json-modal-title');
			var summary = document.getElementById('aiq-json-modal-summary');
			var body    = document.getElementById('aiq-json-modal-body');
			var closeBtn = document.getElementById('aiq-json-modal-close');
			var copyBtn  = document.getElementById('aiq-json-modal-copy');

			var REST_BASE = <?php echo wp_json_encode( $rest_url ); ?>;
			var NONCE     = <?php echo wp_json_encode( $nonce ); ?>;
			var current   = null;

			function openModal(){ modal.style.display = 'block'; document.body.style.overflow = 'hidden'; }
			function closeModal(){ modal.style.display = 'none'; document.body.style.overflow = ''; }

			closeBtn.addEventListener('click', closeModal);
			modal.addEventListener('click', function(e){ if (e.target === modal) closeModal(); });

			copyBtn.addEventListener('click', function(){
				if (!current) return;
				navigator.clipboard.writeText(JSON.stringify(current, null, 2)).then(function(){
					var orig = copyBtn.textContent;
					copyBtn.textContent = 'Copied!';
					setTimeout(function(){ copyBtn.textContent = orig; }, 1500);
				});
			});

			document.addEventListener('click', function(e){
				var link = e.target.closest('.aiq-view-json');
				if (!link) return;
				e.preventDefault();
				var id = link.getAttribute('data-id');

				title.textContent = 'Submission #' + id;
				summary.textContent = 'Loading…';
				body.textContent = '';
				openModal();

				fetch(REST_BASE + id, {
					credentials: 'same-origin',
					headers: { 'X-WP-Nonce': NONCE }
				}).then(function(r){ return r.json(); }).then(function(data){
					current = data;
					var parts = [];
					if (data.email) parts.push('Email: ' + data.email);
					if (data.company) parts.push('Company: ' + data.company);
					if (data.sector) parts.push('Sector: ' + data.sector);
					if (data.overall_score !== null && data.overall_score !== undefined) {
						parts.push('Overall: ' + Number(data.overall_score).toFixed(2));
					}
					if (data.ctem_skipped) parts.push('CTEM: skipped');
					summary.textContent = parts.join('  ·  ');
					body.textContent = JSON.stringify(data, null, 2);
				}).catch(function(err){
					summary.textContent = 'Failed to load submission: ' + err.message;
				});
			});
		})();
		</script>
		<?php
	}

	private static function build_export_url() {
		$pass_through = array( 'date_from', 'date_to', 'min_score', 'max_score', 'sector', 'ctem_skipped', 's', 'orderby', 'order' );
		$args = array(
			'action'   => 'aiq_export_csv',
			'_wpnonce' => wp_create_nonce( 'aiq_export_csv' ),
		);
		foreach ( $pass_through as $key ) {
			if ( isset( $_GET[ $key ] ) && '' !== $_GET[ $key ] ) {
				$args[ $key ] = sanitize_text_field( $_GET[ $key ] );
			}
		}
		return add_query_arg( $args, admin_url( 'admin-post.php' ) );
	}

	public function handle_export_csv() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( __( 'Insufficient permissions', 'attackiq-inform-assessment' ) );
		}
		check_admin_referer( 'aiq_export_csv' );

		$args = AIQ_Admin_List_Table::filters_from_request( $_GET );
		// Bypass list pagination for the export — pull a single big batch.
		// query_submissions caps per_page at 100; we paginate server-side
		// here to handle larger result sets without hitting that cap.
		$args['per_page'] = 100;

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="aiq-inform-submissions-' . date( 'Ymd-His' ) . '.csv"' );

		$out = fopen( 'php://output', 'w' );
		// UTF-8 BOM so Excel renders unicode (sectors, regulatory frameworks) correctly.
		fwrite( $out, "\xEF\xBB\xBF" );

		$columns = array(
			'id', 'created_at', 'email', 'first_name', 'last_name', 'company',
			'sector', 'region', 'revenue_band', 'headcount_band',
			'regulatory', 'data_sensitivity',
			'overall_score', 'cti_score', 'dm_score', 'te_score', 'ctem_score',
			'ctem_skipped', 'maturity_level',
		);
		fputcsv( $out, $columns );

		$page = 1;
		do {
			$args['page'] = $page;
			$result = AIQ_DB::query_submissions( $args );

			foreach ( $result['rows'] as $row ) {
				$reg = self::decode_list( $row['regulatory_json'] );
				$ds  = self::decode_list( $row['data_sensitivity_json'] );

				fputcsv( $out, array(
					$row['id'],
					$row['created_at'],
					$row['email'],
					$row['first_name'],
					$row['last_name'],
					$row['company'],
					$row['sector'],
					$row['region'],
					$row['revenue_band'],
					$row['headcount_band'],
					implode( '; ', $reg ),
					implode( '; ', $ds ),
					$row['overall_score'],
					$row['cti_score'],
					$row['dm_score'],
					$row['te_score'],
					$row['ctem_score'],
					$row['ctem_skipped'] ? 'Yes' : 'No',
					$row['maturity_level'],
				) );
			}

			$page++;
			$total_pages = max( 1, (int) ceil( $result['total'] / $args['per_page'] ) );
		} while ( $page <= $total_pages );

		fclose( $out );
		exit;
	}

	private static function decode_list( $json ) {
		if ( empty( $json ) ) return array();
		$decoded = json_decode( $json, true );
		return is_array( $decoded ) ? array_map( 'strval', $decoded ) : array();
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

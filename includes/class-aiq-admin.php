<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AIQ_Admin {

	const MENU_SLUG = 'aiq-submissions';

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_post_aiq_export_csv', array( $this, 'handle_export_csv' ) );
		add_action( 'admin_post_aiq_delete_submission', array( $this, 'handle_delete_submission' ) );
		add_action( 'admin_notices', array( $this, 'maybe_render_admin_notices' ) );
	}

	public function handle_delete_submission() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( __( 'Insufficient permissions', 'attackiq-inform-assessment' ) );
		}
		$id = isset( $_GET['id'] ) ? intval( $_GET['id'] ) : 0;
		check_admin_referer( 'aiq_delete_submission_' . $id );

		$ok = $id > 0 ? AIQ_DB::delete_submission( $id ) : false;

		$args = array(
			'page' => self::MENU_SLUG,
			'aiq_deleted' => $ok ? '1' : '0',
		);
		foreach ( array( 'date_from', 'date_to', 'min_score', 'max_score', 'sector', 'ctem_skipped', 's', 'paged' ) as $k ) {
			if ( isset( $_GET[ $k ] ) && '' !== $_GET[ $k ] ) {
				$args[ $k ] = sanitize_text_field( $_GET[ $k ] );
			}
		}
		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php' ) ) );
		exit;
	}

	public function maybe_render_admin_notices() {
		if ( ! isset( $_GET['page'] ) || self::MENU_SLUG !== $_GET['page'] ) {
			return;
		}
		if ( ! isset( $_GET['aiq_deleted'] ) ) {
			return;
		}
		if ( '1' === $_GET['aiq_deleted'] ) {
			echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Submission deleted.', 'attackiq-inform-assessment' ) . '</p></div>';
		} else {
			echo '<div class="notice notice-error is-dismissible"><p>' . esc_html__( 'Could not delete submission.', 'attackiq-inform-assessment' ) . '</p></div>';
		}
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

		add_submenu_page(
			self::MENU_SLUG,
			__( 'INFORM Submissions', 'attackiq-inform-assessment' ),
			__( 'Submissions', 'attackiq-inform-assessment' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_list_page' )
		);
	}

	public function render_list_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( __( 'Insufficient permissions', 'attackiq-inform-assessment' ) );
		}

		$table = new AIQ_Admin_List_Table();
		$table->prepare_items();

		$sectors    = self::distinct_sectors();
		$detail_map = self::build_detail_map( $table->items );
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

			<?php $this->render_view_detail_modal( $detail_map ); ?>
		</div>
		<?php
	}

	private static function build_detail_map( $items ) {
		$map = array();
		if ( ! is_array( $items ) ) {
			return $map;
		}
		foreach ( $items as $item ) {
			$id  = isset( $item['id'] ) ? intval( $item['id'] ) : 0;
			if ( $id <= 0 ) {
				continue;
			}
			$row = AIQ_DB::get_submission( $id );
			if ( ! $row ) {
				continue;
			}
			$map[ $id ] = array(
				'id'               => intval( $row['id'] ),
				'created_at'       => $row['created_at'],
				'cpt_post_id'      => $row['cpt_post_id'] ? intval( $row['cpt_post_id'] ) : null,
				'email'            => $row['email'],
				'first_name'       => $row['first_name'],
				'last_name'        => $row['last_name'],
				'company'          => $row['company'],
				'sector'           => $row['sector'],
				'region'           => $row['region'],
				'revenue_band'     => $row['revenue_band'],
				'headcount_band'   => $row['headcount_band'],
				'regulatory'       => self::maybe_decode( $row['regulatory_json'] ),
				'data_sensitivity' => self::maybe_decode( $row['data_sensitivity_json'] ),
				'overall_score'    => null !== $row['overall_score'] ? floatval( $row['overall_score'] ) : null,
				'cti_score'        => null !== $row['cti_score'] ? intval( $row['cti_score'] ) : null,
				'dm_score'         => null !== $row['dm_score'] ? intval( $row['dm_score'] ) : null,
				'te_score'         => null !== $row['te_score'] ? intval( $row['te_score'] ) : null,
				'ctem_score'       => null !== $row['ctem_score'] ? intval( $row['ctem_score'] ) : null,
				'ctem_skipped'     => (bool) $row['ctem_skipped'],
				'maturity_level'   => null !== $row['maturity_level'] ? intval( $row['maturity_level'] ) : null,
				'answers'          => self::maybe_decode( $row['answers_json'] ),
				'recommendations'  => self::maybe_decode( $row['recommendations_json'] ),
				'threat_profile'   => self::maybe_decode( $row['threat_profile_json'] ),
				'ip'               => $row['ip'],
				'user_agent'       => $row['user_agent'],
			);
		}
		return $map;
	}

	private static function maybe_decode( $json ) {
		if ( empty( $json ) ) {
			return null;
		}
		$decoded = json_decode( $json, true );
		return ( JSON_ERROR_NONE === json_last_error() ) ? $decoded : null;
	}

	private function render_view_detail_modal( $detail_map = array() ) {
		?>
		<style>
			#aiq-detail-modal .aiq-section { margin-bottom: 22px; }
			#aiq-detail-modal .aiq-section h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #50575e; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
			#aiq-detail-modal .aiq-kv { display: grid; grid-template-columns: 180px 1fr; gap: 6px 14px; font-size: 13px; }
			#aiq-detail-modal .aiq-kv dt { color: #646970; font-weight: 500; }
			#aiq-detail-modal .aiq-kv dd { margin: 0; color: #1d2327; word-break: break-word; }
			#aiq-detail-modal .aiq-kv dd .aiq-tag { display: inline-block; background: #f0f0f1; border-radius: 3px; padding: 2px 8px; margin: 1px 4px 1px 0; font-size: 12px; }
			#aiq-detail-modal .aiq-scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
			#aiq-detail-modal .aiq-score-card { background: #f6f7f7; border: 1px solid #e0e0e0; border-radius: 4px; padding: 10px 12px; }
			#aiq-detail-modal .aiq-score-card .label { font-size: 11px; text-transform: uppercase; color: #646970; letter-spacing: 0.04em; }
			#aiq-detail-modal .aiq-score-card .value { font-size: 20px; font-weight: 600; color: #1d2327; margin-top: 4px; }
			#aiq-detail-modal .aiq-score-card.skipped .value { color: #b32d2e; font-size: 14px; font-weight: 500; }
			#aiq-detail-modal .aiq-list { margin: 0; padding-left: 20px; font-size: 13px; }
			#aiq-detail-modal .aiq-list li { margin-bottom: 4px; }
			#aiq-detail-modal pre.aiq-json { background: #0e1116; color: #e6edf3; padding: 14px; border-radius: 4px; font-size: 12px; line-height: 1.5; overflow: auto; max-height: 60vh; margin: 0; }
			#aiq-detail-modal .aiq-empty { color: #8c8f94; font-style: italic; font-size: 13px; }
			#aiq-detail-modal .aiq-nested { margin: 4px 0 8px; padding: 8px 12px; background: #f6f7f7; border-radius: 4px; }
			#aiq-detail-modal .aiq-nested + .aiq-nested { margin-top: 4px; }
			#aiq-detail-modal .aiq-nested-key { font-weight: 600; font-size: 12px; color: #2c3338; margin-bottom: 4px; }
			#aiq-detail-modal .aiq-answer-group { margin-bottom: 14px; }
			#aiq-detail-modal .aiq-answer-group-title { font-size: 12px; font-weight: 600; color: #2c3338; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 6px; }
			#aiq-detail-modal .aiq-answer-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px; }
			#aiq-detail-modal .aiq-answer-cell { background: #f6f7f7; border-radius: 4px; padding: 6px 10px; }
			#aiq-detail-modal .aiq-answer-cell .k { font-size: 11px; color: #646970; font-weight: 600; }
			#aiq-detail-modal .aiq-answer-cell .v { font-size: 14px; color: #1d2327; margin-top: 2px; }
			#aiq-detail-modal .aiq-rec-card { background: #fff; border: 1px solid #dcdcde; border-radius: 6px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
			#aiq-detail-modal .aiq-rec-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #f0f0f1; flex-wrap: wrap; }
			#aiq-detail-modal .aiq-rec-title { font-size: 14px; font-weight: 600; color: #1d2327; margin: 0; flex: 1; min-width: 220px; }
			#aiq-detail-modal .aiq-rec-pills { display: flex; gap: 6px; flex-wrap: wrap; }
			#aiq-detail-modal .aiq-pill { font-size: 11px; padding: 3px 9px; border-radius: 999px; background: #f0f0f1; color: #2c3338; font-weight: 500; }
			#aiq-detail-modal .aiq-pill.section { background: #dbeafe; color: #1e40af; }
			#aiq-detail-modal .aiq-pill.impact { background: #fef3c7; color: #92400e; }
			#aiq-detail-modal .aiq-pill.complexity { background: #e0e7ff; color: #3730a3; }
			#aiq-detail-modal .aiq-rec-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px 16px; margin-bottom: 10px; font-size: 13px; }
			#aiq-detail-modal .aiq-rec-meta .label { color: #646970; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; margin-bottom: 2px; }
			#aiq-detail-modal .aiq-rec-meta .value { color: #1d2327; }
			#aiq-detail-modal .aiq-rec-block { margin-top: 10px; }
			#aiq-detail-modal .aiq-rec-block-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #646970; font-weight: 600; margin-bottom: 4px; }
			#aiq-detail-modal .aiq-rec-block-body { font-size: 13px; color: #1d2327; line-height: 1.55; }
			#aiq-detail-modal .aiq-rec-block-body p { margin: 0 0 6px; }
			#aiq-detail-modal .aiq-rec-block-body p:last-child { margin-bottom: 0; }
		</style>
		<div id="aiq-detail-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100000;">
			<div style="background:#fff;max-width:960px;width:92%;max-height:90vh;margin:3vh auto;border-radius:6px;display:flex;flex-direction:column;overflow:hidden;">
				<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #ddd;background:#f7f7f7;">
					<h2 id="aiq-detail-modal-title" style="margin:0;font-size:16px;">Submission</h2>
					<div>
						<button type="button" class="button" id="aiq-detail-modal-toggle"><?php esc_html_e( 'View Raw JSON', 'attackiq-inform-assessment' ); ?></button>
						<button type="button" class="button" id="aiq-detail-modal-copy" style="margin-left:6px;"><?php esc_html_e( 'Copy JSON', 'attackiq-inform-assessment' ); ?></button>
						<button type="button" class="button" id="aiq-detail-modal-close" style="margin-left:6px;"><?php esc_html_e( 'Close', 'attackiq-inform-assessment' ); ?></button>
					</div>
				</div>
				<div style="padding:18px 22px;overflow:auto;">
					<div id="aiq-detail-modal-formatted"></div>
					<pre id="aiq-detail-modal-raw" class="aiq-json" style="display:none;"></pre>
				</div>
			</div>
		</div>
		<script>
		(function(){
			var modal      = document.getElementById('aiq-detail-modal');
			var title      = document.getElementById('aiq-detail-modal-title');
			var formatted  = document.getElementById('aiq-detail-modal-formatted');
			var raw        = document.getElementById('aiq-detail-modal-raw');
			var closeBtn   = document.getElementById('aiq-detail-modal-close');
			var copyBtn    = document.getElementById('aiq-detail-modal-copy');
			var toggleBtn  = document.getElementById('aiq-detail-modal-toggle');

			var SUBMISSIONS = <?php echo wp_json_encode( (object) $detail_map ); ?>;
			var current     = null;
			var showingRaw  = false;

			function openModal(){ modal.style.display = 'block'; document.body.style.overflow = 'hidden'; }
			function closeModal(){ modal.style.display = 'none'; document.body.style.overflow = ''; showingRaw = false; formatted.style.display = ''; raw.style.display = 'none'; toggleBtn.textContent = '<?php echo esc_js( __( 'View Raw JSON', 'attackiq-inform-assessment' ) ); ?>'; }

			closeBtn.addEventListener('click', closeModal);
			modal.addEventListener('click', function(e){ if (e.target === modal) closeModal(); });

			toggleBtn.addEventListener('click', function(){
				showingRaw = !showingRaw;
				if (showingRaw) {
					formatted.style.display = 'none';
					raw.style.display = '';
					toggleBtn.textContent = '<?php echo esc_js( __( 'View Formatted', 'attackiq-inform-assessment' ) ); ?>';
				} else {
					formatted.style.display = '';
					raw.style.display = 'none';
					toggleBtn.textContent = '<?php echo esc_js( __( 'View Raw JSON', 'attackiq-inform-assessment' ) ); ?>';
				}
			});

			copyBtn.addEventListener('click', function(){
				if (!current) return;
				navigator.clipboard.writeText(JSON.stringify(current, null, 2)).then(function(){
					var orig = copyBtn.textContent;
					copyBtn.textContent = '<?php echo esc_js( __( 'Copied!', 'attackiq-inform-assessment' ) ); ?>';
					setTimeout(function(){ copyBtn.textContent = orig; }, 1500);
				});
			});

			function esc(s) {
				if (s === null || s === undefined) return '';
				return String(s).replace(/[&<>"']/g, function(c){
					return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
				});
			}

			function fmtScore(n) {
				if (n === null || n === undefined) return '—';
				var num = Number(n);
				if (isNaN(num)) return '—';
				return num <= 1 ? num.toFixed(2) : String(num);
			}

			function isPlainObject(v) {
				return v !== null && typeof v === 'object' && !Array.isArray(v);
			}

			function renderValue(v) {
				if (v === null || v === undefined || v === '') return '<span class="aiq-empty">—</span>';
				if (Array.isArray(v)) {
					if (v.length === 0) return '<span class="aiq-empty">—</span>';
					if (v.every(function(x){ return !isPlainObject(x) && !Array.isArray(x); })) {
						return v.map(function(x){ return '<span class="aiq-tag">' + esc(x) + '</span>'; }).join('');
					}
					return '<ul class="aiq-list">' + v.map(function(x){
						return '<li>' + (isPlainObject(x) ? renderObject(x) : renderValue(x)) + '</li>';
					}).join('') + '</ul>';
				}
				if (isPlainObject(v)) return renderObject(v);
				return esc(v);
			}

			function renderObject(obj) {
				var keys = Object.keys(obj);
				if (keys.length === 0) return '<span class="aiq-empty">—</span>';
				return keys.map(function(k){
					return '<div class="aiq-nested">' +
						'<div class="aiq-nested-key">' + esc(humanize(k)) + '</div>' +
						'<div>' + renderValue(obj[k]) + '</div>' +
						'</div>';
				}).join('');
			}

			function humanize(key) {
				return String(key).replace(/_/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
			}

			function kvRow(label, value) {
				return '<dt>' + esc(label) + '</dt><dd>' + (value || '<span class="aiq-empty">—</span>') + '</dd>';
			}

			function splitSentences(text) {
				if (!text) return [];
				var s = String(text);
				s = s.replace(/\.([A-Z])/g, '.\n$1');
				return s.split(/\n+/).map(function(x){ return x.trim(); }).filter(Boolean);
			}

			function renderTextBlock(text) {
				var parts = splitSentences(text);
				if (parts.length === 0) return '<p>' + esc(text) + '</p>';
				return parts.map(function(p){ return '<p>' + esc(p) + '</p>'; }).join('');
			}

			function pickFirst(obj /*, keys */) {
				for (var i = 1; i < arguments.length; i++) {
					var k = arguments[i];
					if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
				}
				return null;
			}

			function renderRecommendationCard(rec) {
				if (!isPlainObject(rec)) return '<div class="aiq-rec-card">' + renderValue(rec) + '</div>';

				var label    = pickFirst(rec, 'ComponentLabel', 'componentLabel', 'label', 'title');
				var section  = pickFirst(rec, 'SectionId', 'sectionId', 'section');
				var impact   = pickFirst(rec, 'Impact', 'impact');
				var complex  = pickFirst(rec, 'Complexity', 'complexity');
				var choice   = rec.ChoiceBlock || rec.choiceBlock || rec.choice || null;
				var goal     = pickFirst(rec, 'LevelGoal', 'levelGoal', 'goal');
				var recText  = pickFirst(rec, 'Recommendations', 'recommendations', 'recommendation');

				var handled = { ComponentLabel:1, componentLabel:1, label:1, title:1,
					SectionId:1, sectionId:1, section:1, Impact:1, impact:1,
					Complexity:1, complexity:1, ChoiceBlock:1, choiceBlock:1, choice:1,
					LevelGoal:1, levelGoal:1, goal:1, Recommendations:1, recommendations:1, recommendation:1 };

				var html = '<div class="aiq-rec-card">';

				html += '<div class="aiq-rec-header">' +
					'<h4 class="aiq-rec-title">' + (label ? esc(label) : 'Recommendation') + '</h4>' +
					'<div class="aiq-rec-pills">' +
					(section ? '<span class="aiq-pill section">' + esc(section) + '</span>' : '') +
					(impact  !== null ? '<span class="aiq-pill impact">Impact: ' + esc(impact) + '</span>' : '') +
					(complex !== null ? '<span class="aiq-pill complexity">Complexity: ' + esc(complex) + '</span>' : '') +
					'</div></div>';

				if (choice && isPlainObject(choice)) {
					var choiceUid   = pickFirst(choice, 'ChoiceUid', 'choiceUid', 'uid');
					var selected    = pickFirst(choice, 'SelectedLabel', 'selectedLabel', 'selected', 'label');
					var owner       = pickFirst(choice, 'PrimaryOwner', 'primaryOwner', 'owner');
					var choiceMeta  = '';
					if (choiceUid !== null) choiceMeta += '<div><div class="label">Choice ID</div><div class="value">' + esc(choiceUid) + '</div></div>';
					if (selected !== null) choiceMeta += '<div><div class="label">Selected</div><div class="value">' + esc(selected) + '</div></div>';
					if (owner !== null)    choiceMeta += '<div><div class="label">Primary owner</div><div class="value">' + esc(owner) + '</div></div>';
					if (choiceMeta) html += '<div class="aiq-rec-meta">' + choiceMeta + '</div>';
				}

				if (goal) {
					html += '<div class="aiq-rec-block">' +
						'<div class="aiq-rec-block-label">Level goal</div>' +
						'<div class="aiq-rec-block-body">' + renderTextBlock(goal) + '</div>' +
						'</div>';
				}

				if (recText) {
					html += '<div class="aiq-rec-block">' +
						'<div class="aiq-rec-block-label">Recommendations</div>' +
						'<div class="aiq-rec-block-body">' + renderTextBlock(recText) + '</div>' +
						'</div>';
				}

				var extra = '';
				Object.keys(rec).forEach(function(k){
					if (handled[k]) return;
					var v = rec[k];
					if (v === null || v === undefined || v === '') return;
					extra += '<div><div class="label">' + esc(humanize(k)) + '</div><div class="value">' + renderValue(v) + '</div></div>';
				});
				if (extra) html += '<div class="aiq-rec-meta" style="margin-top:10px;">' + extra + '</div>';

				html += '</div>';
				return html;
			}

			function renderRecommendations(recs) {
				if (!recs) return '<div class="aiq-empty">No recommendations</div>';
				if (Array.isArray(recs)) {
					if (recs.length === 0) return '<div class="aiq-empty">No recommendations</div>';
					return recs.map(renderRecommendationCard).join('');
				}
				if (isPlainObject(recs)) return renderRecommendationCard(recs);
				return renderValue(recs);
			}

			function renderAnswers(answers) {
				if (!answers) return '<div class="aiq-empty">No answers recorded</div>';
				if (!isPlainObject(answers)) return renderValue(answers);

				var keys = Object.keys(answers);
				if (keys.length === 0) return '<div class="aiq-empty">No answers recorded</div>';

				var groups = {};
				var groupOrder = [];
				var ungrouped = [];
				keys.forEach(function(k){
					var m = String(k).match(/^([A-Za-z]+)[._-]?(.*)$/);
					var prefix = m && m[1] ? m[1].toUpperCase() : '';
					var rest   = m && m[2] ? m[2] : k;
					if (!prefix || prefix === k.toUpperCase()) {
						ungrouped.push({ key: k, label: k });
						return;
					}
					if (!groups[prefix]) { groups[prefix] = []; groupOrder.push(prefix); }
					groups[prefix].push({ key: k, label: rest || k });
				});

				function sortKeys(items) {
					items.sort(function(a, b){
						var na = parseInt(a.label, 10), nb = parseInt(b.label, 10);
						if (!isNaN(na) && !isNaN(nb)) return na - nb;
						return a.key.localeCompare(b.key);
					});
				}

				var html = '';
				groupOrder.forEach(function(g){
					sortKeys(groups[g]);
					html += '<div class="aiq-answer-group">' +
						'<h4 class="aiq-answer-group-title">' + esc(g) + '</h4>' +
						'<div class="aiq-answer-grid">' +
						groups[g].map(function(item){
							var v = answers[item.key];
							var vHtml = (v === null || v === undefined || v === '')
								? '<span class="aiq-empty">—</span>'
								: (isPlainObject(v) || Array.isArray(v) ? renderValue(v) : esc(v));
							return '<div class="aiq-answer-cell"><div class="k">' + esc(item.label) + '</div><div class="v">' + vHtml + '</div></div>';
						}).join('') +
						'</div></div>';
				});

				if (ungrouped.length) {
					sortKeys(ungrouped);
					html += '<div class="aiq-answer-group">' +
						'<h4 class="aiq-answer-group-title">Other</h4>' +
						'<div class="aiq-answer-grid">' +
						ungrouped.map(function(item){
							var v = answers[item.key];
							var vHtml = (v === null || v === undefined || v === '')
								? '<span class="aiq-empty">—</span>'
								: (isPlainObject(v) || Array.isArray(v) ? renderValue(v) : esc(v));
							return '<div class="aiq-answer-cell"><div class="k">' + esc(item.label) + '</div><div class="v">' + vHtml + '</div></div>';
						}).join('') +
						'</div></div>';
				}

				return html;
			}

			function buildFormatted(d) {
				var name = [d.first_name, d.last_name].filter(Boolean).join(' ');

				var contact = '<div class="aiq-section"><h3>Contact</h3><dl class="aiq-kv">' +
					kvRow('Email', d.email ? esc(d.email) : '') +
					kvRow('Name', esc(name)) +
					kvRow('Company', esc(d.company)) +
					'</dl></div>';

				var profile = '<div class="aiq-section"><h3>Profile</h3><dl class="aiq-kv">' +
					kvRow('Sector', esc(d.sector)) +
					kvRow('Region', esc(d.region)) +
					kvRow('Revenue band', esc(d.revenue_band)) +
					kvRow('Headcount band', esc(d.headcount_band)) +
					kvRow('Regulatory', renderValue(d.regulatory)) +
					kvRow('Data sensitivity', renderValue(d.data_sensitivity)) +
					'</dl></div>';

				var scoreCard = function(label, val, isSkipped){
					var cls = isSkipped ? 'aiq-score-card skipped' : 'aiq-score-card';
					var v   = isSkipped ? 'Skipped' : fmtScore(val);
					return '<div class="' + cls + '"><div class="label">' + esc(label) + '</div><div class="value">' + esc(v) + '</div></div>';
				};

				var scores = '<div class="aiq-section"><h3>Scores</h3><div class="aiq-scores">' +
					scoreCard('Overall', d.overall_score, false) +
					scoreCard('CTI', d.cti_score, false) +
					scoreCard('DM', d.dm_score, false) +
					scoreCard('TE', d.te_score, false) +
					scoreCard('CTEM', d.ctem_score, !!d.ctem_skipped) +
					scoreCard('Maturity', d.maturity_level, false) +
					'</div></div>';

				var answers = '<div class="aiq-section"><h3>Answers</h3>' +
					renderAnswers(d.answers) +
					'</div>';

				var recs = '<div class="aiq-section"><h3>Recommendations</h3>' +
					renderRecommendations(d.recommendations) +
					'</div>';

				var threat = '<div class="aiq-section"><h3>Threat Profile</h3>' +
					(d.threat_profile ? renderValue(d.threat_profile) : '<div class="aiq-empty">No threat profile</div>') +
					'</div>';

				var meta = '<div class="aiq-section"><h3>Metadata</h3><dl class="aiq-kv">' +
					kvRow('Submission ID', esc(d.id)) +
					kvRow('Submitted', esc(d.created_at) + ' (UTC)') +
					kvRow('Legacy CPT ID', d.cpt_post_id ? esc(d.cpt_post_id) : '') +
					kvRow('IP address', esc(d.ip)) +
					kvRow('User agent', esc(d.user_agent)) +
					'</dl></div>';

				return contact + profile + scores + answers + recs + threat + meta;
			}

			document.addEventListener('click', function(e){
				var link = e.target.closest('.aiq-view-json');
				if (!link) return;
				e.preventDefault();
				var id = link.getAttribute('data-id');

				title.textContent = 'Submission #' + id;
				openModal();

				var data = SUBMISSIONS && SUBMISSIONS[id];
				if (!data) {
					formatted.innerHTML = '<div class="aiq-empty">Submission data not available on this page.</div>';
					raw.textContent = '';
					current = null;
					return;
				}
				current = data;
				formatted.innerHTML = buildFormatted(data);
				raw.textContent = JSON.stringify(data, null, 2);
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

		$args['per_page'] = 500;

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="aiq-inform-submissions-' . date( 'Ymd-His' ) . '.csv"' );

		$out = fopen( 'php://output', 'w' );

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
			$total_pages = max( 1, (int) ceil( $result['total'] / 500 ) );
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

		$rows = $wpdb->get_col( "SELECT DISTINCT sector FROM {$tbl} WHERE sector IS NOT NULL AND sector != '' ORDER BY sector ASC" );
		return is_array( $rows ) ? $rows : array();
	}
}

new AIQ_Admin();

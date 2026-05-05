<?php
/**
 * Phase 2 — Submissions database layer.
 *
 * Replaces post-meta storage on the legacy aiq_submission CPT with a
 * dedicated wp_aiq_submissions table that is cheap to query, sort, and
 * filter from the wp-admin list UI (Day 5) and the external REST API
 * (Day 4). The CPT continues to receive writes during the transition; this
 * class adds the structured table alongside it.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AIQ_DB {

	/**
	 * Schema version. Bump when changing column shape so the upgrade hook
	 * can re-run dbDelta on existing installs without a manual deactivate /
	 * reactivate.
	 */
	const SCHEMA_VERSION = '1.0.0';

	const VERSION_OPTION_KEY = 'aiq_db_schema_version';
	const ERROR_LOG_OPTION_KEY = 'aiq_db_errors';

	public static function get_table_name() {
		global $wpdb;
		return $wpdb->prefix . 'aiq_submissions';
	}

	/**
	 * Run on plugin activation and on every plugin load when the stored
	 * schema version differs from SCHEMA_VERSION.
	 */
	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table_name      = self::get_table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table_name} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			cpt_post_id BIGINT UNSIGNED NULL,
			email VARCHAR(190) NULL,
			first_name VARCHAR(120) NULL,
			last_name VARCHAR(120) NULL,
			company VARCHAR(190) NULL,
			sector VARCHAR(120) NULL,
			region VARCHAR(120) NULL,
			revenue_band VARCHAR(60) NULL,
			headcount_band VARCHAR(60) NULL,
			regulatory_json LONGTEXT NULL,
			data_sensitivity_json LONGTEXT NULL,
			overall_score FLOAT NULL,
			cti_score INT NULL,
			dm_score INT NULL,
			te_score INT NULL,
			ctem_score INT NULL,
			ctem_skipped TINYINT(1) NOT NULL DEFAULT 0,
			maturity_level INT NULL,
			answers_json LONGTEXT NOT NULL,
			recommendations_json LONGTEXT NULL,
			threat_profile_json LONGTEXT NULL,
			ip VARCHAR(45) NULL,
			user_agent VARCHAR(255) NULL,
			PRIMARY KEY  (id),
			KEY idx_created_at (created_at),
			KEY idx_email (email),
			KEY idx_sector (sector),
			KEY idx_overall (overall_score),
			KEY idx_cpt_post_id (cpt_post_id)
		) {$charset_collate};";

		dbDelta( $sql );

		update_option( self::VERSION_OPTION_KEY, self::SCHEMA_VERSION );
	}

	/**
	 * Called on every page load. If the stored version is missing or
	 * doesn't match, re-run install(). Cheap on the happy path.
	 */
	public static function maybe_upgrade() {
		$installed = get_option( self::VERSION_OPTION_KEY );
		if ( $installed !== self::SCHEMA_VERSION ) {
			self::install();
		}
	}

	/**
	 * Insert a fully-prepared submission row.
	 *
	 * Returns the new row id on success, or WP_Error on failure. The CPT
	 * write upstream is independent — failures here are logged but do not
	 * break the user-facing submit flow.
	 */
	public static function insert_submission( array $data ) {
		global $wpdb;

		$table = self::get_table_name();

		$row = array(
			'created_at'            => current_time( 'mysql', true ),
			'cpt_post_id'           => isset( $data['cpt_post_id'] ) ? intval( $data['cpt_post_id'] ) : null,
			'email'                 => isset( $data['email'] ) ? substr( sanitize_email( $data['email'] ), 0, 190 ) : null,
			'first_name'            => isset( $data['first_name'] ) ? substr( sanitize_text_field( $data['first_name'] ), 0, 120 ) : null,
			'last_name'             => isset( $data['last_name'] ) ? substr( sanitize_text_field( $data['last_name'] ), 0, 120 ) : null,
			'company'               => isset( $data['company'] ) ? substr( sanitize_text_field( $data['company'] ), 0, 190 ) : null,
			'sector'                => isset( $data['sector'] ) ? substr( sanitize_text_field( $data['sector'] ), 0, 120 ) : null,
			'region'                => isset( $data['region'] ) ? substr( sanitize_text_field( $data['region'] ), 0, 120 ) : null,
			'revenue_band'          => isset( $data['revenue_band'] ) ? substr( sanitize_text_field( $data['revenue_band'] ), 0, 60 ) : null,
			'headcount_band'        => isset( $data['headcount_band'] ) ? substr( sanitize_text_field( $data['headcount_band'] ), 0, 60 ) : null,
			'regulatory_json'       => isset( $data['regulatory_json'] ) ? wp_json_encode( $data['regulatory_json'] ) : null,
			'data_sensitivity_json' => isset( $data['data_sensitivity_json'] ) ? wp_json_encode( $data['data_sensitivity_json'] ) : null,
			'overall_score'         => isset( $data['overall_score'] ) ? floatval( $data['overall_score'] ) : null,
			'cti_score'             => isset( $data['cti_score'] ) ? intval( $data['cti_score'] ) : null,
			'dm_score'              => isset( $data['dm_score'] ) ? intval( $data['dm_score'] ) : null,
			'te_score'              => isset( $data['te_score'] ) ? intval( $data['te_score'] ) : null,
			'ctem_score'            => isset( $data['ctem_score'] ) ? intval( $data['ctem_score'] ) : null,
			'ctem_skipped'          => ! empty( $data['ctem_skipped'] ) ? 1 : 0,
			'maturity_level'        => isset( $data['maturity_level'] ) ? intval( $data['maturity_level'] ) : null,
			'answers_json'          => wp_json_encode( isset( $data['answers'] ) ? $data['answers'] : array() ),
			'recommendations_json'  => isset( $data['recommendations'] ) ? wp_json_encode( $data['recommendations'] ) : null,
			'threat_profile_json'   => isset( $data['threat_profile'] ) ? wp_json_encode( $data['threat_profile'] ) : null,
			'ip'                    => isset( $data['ip'] ) ? substr( sanitize_text_field( $data['ip'] ), 0, 45 ) : null,
			'user_agent'            => isset( $data['user_agent'] ) ? substr( sanitize_text_field( $data['user_agent'] ), 0, 255 ) : null,
		);

		$result = $wpdb->insert( $table, $row );

		if ( false === $result ) {
			self::log_error( 'insert_failed', $wpdb->last_error, array( 'cpt_post_id' => $row['cpt_post_id'] ) );
			return new WP_Error( 'aiq_db_insert_failed', $wpdb->last_error ?: 'Unknown DB error' );
		}

		return (int) $wpdb->insert_id;
	}

	/**
	 * Whitelisted columns the external API is allowed to sort on. Anything
	 * else falls back to created_at DESC.
	 */
	const ALLOWED_ORDERBY = array( 'id', 'created_at', 'overall_score', 'sector', 'email' );

	/**
	 * Run a filtered query against wp_aiq_submissions.
	 *
	 * Returns ['rows' => array, 'total' => int]. Caller is responsible for
	 * authorization — this method is shared by the external API and the
	 * upcoming wp-admin list UI.
	 */
	public static function query_submissions( array $args = array() ) {
		global $wpdb;
		$table = self::get_table_name();

		$defaults = array(
			'date_from'    => '',
			'date_to'      => '',
			'min_score'    => null,
			'max_score'    => null,
			'sector'       => '',
			'email'        => '',
			'ctem_skipped' => null,
			'page'         => 1,
			'per_page'     => 25,
			'orderby'      => 'created_at',
			'order'        => 'DESC',
		);
		$args = array_merge( $defaults, $args );

		$where  = array( '1=1' );
		$params = array();

		if ( ! empty( $args['date_from'] ) ) {
			$where[]  = 'created_at >= %s';
			$params[] = $args['date_from'];
		}
		if ( ! empty( $args['date_to'] ) ) {
			$where[]  = 'created_at <= %s';
			$params[] = $args['date_to'];
		}
		if ( null !== $args['min_score'] && '' !== $args['min_score'] ) {
			$where[]  = 'overall_score >= %f';
			$params[] = floatval( $args['min_score'] );
		}
		if ( null !== $args['max_score'] && '' !== $args['max_score'] ) {
			$where[]  = 'overall_score <= %f';
			$params[] = floatval( $args['max_score'] );
		}
		if ( ! empty( $args['sector'] ) ) {
			$where[]  = 'sector = %s';
			$params[] = $args['sector'];
		}
		if ( ! empty( $args['email'] ) ) {
			$where[]  = 'email LIKE %s';
			$params[] = '%' . $wpdb->esc_like( $args['email'] ) . '%';
		}
		if ( null !== $args['ctem_skipped'] ) {
			$where[]  = 'ctem_skipped = %d';
			$params[] = $args['ctem_skipped'] ? 1 : 0;
		}

		$orderby = in_array( $args['orderby'], self::ALLOWED_ORDERBY, true ) ? $args['orderby'] : 'created_at';
		$order   = strtoupper( $args['order'] ) === 'ASC' ? 'ASC' : 'DESC';

		$per_page = max( 1, min( 100, intval( $args['per_page'] ) ) );
		$page     = max( 1, intval( $args['page'] ) );
		$offset   = ( $page - 1 ) * $per_page;

		$where_sql = implode( ' AND ', $where );

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where_sql}";
		$total = empty( $params )
			? (int) $wpdb->get_var( $count_sql )
			: (int) $wpdb->get_var( $wpdb->prepare( $count_sql, $params ) );

		$select_sql = "SELECT id, created_at, cpt_post_id, email, first_name, last_name, company,
			sector, region, revenue_band, headcount_band, regulatory_json, data_sensitivity_json,
			overall_score, cti_score, dm_score, te_score, ctem_score, ctem_skipped, maturity_level,
			recommendations_json, threat_profile_json, ip
			FROM {$table}
			WHERE {$where_sql}
			ORDER BY {$orderby} {$order}
			LIMIT %d OFFSET %d";

		$rows = $wpdb->get_results(
			$wpdb->prepare( $select_sql, array_merge( $params, array( $per_page, $offset ) ) ),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		return array(
			'rows'  => $rows ? $rows : array(),
			'total' => $total,
		);
	}

	public static function get_submission( $id ) {
		global $wpdb;
		$table = self::get_table_name();
		$id    = intval( $id );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A );
	}

	public static function count_rows() {
		global $wpdb;
		$table = self::get_table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );
	}

	public static function count_cpt_posts() {
		// Counts legacy CPT records regardless of post_status so backfill
		// numbers match what's actually in the CPT.
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'aiq_submission'" );
	}

	public static function has_cpt_been_migrated( $post_id ) {
		global $wpdb;
		$table   = self::get_table_name();
		$post_id = intval( $post_id );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return (bool) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE cpt_post_id = %d LIMIT 1", $post_id ) );
	}

	private static function log_error( $code, $message, $context = array() ) {
		$existing = get_option( self::ERROR_LOG_OPTION_KEY, array() );
		if ( ! is_array( $existing ) ) {
			$existing = array();
		}
		$existing[] = array(
			'time'    => current_time( 'mysql', true ),
			'code'    => $code,
			'message' => $message,
			'context' => $context,
		);
		// Keep only the last 50 entries so the option stays small.
		if ( count( $existing ) > 50 ) {
			$existing = array_slice( $existing, -50 );
		}
		update_option( self::ERROR_LOG_OPTION_KEY, $existing, false );
	}
}

<?php
/**
 * Phase 2 — wp-admin Submissions list table.
 *
 * Standard WP_List_Table extension. The data layer (filters, paging, sort)
 * is delegated entirely to AIQ_DB::query_submissions() so the same contract
 * powers both this UI and the external REST API.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'WP_List_Table' ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class AIQ_Admin_List_Table extends WP_List_Table {

	public function __construct() {
		parent::__construct( array(
			'singular' => 'submission',
			'plural'   => 'submissions',
			'ajax'     => false,
		) );
	}

	public function get_columns() {
		return array(
			'created_at'     => __( 'Date', 'attackiq-inform-assessment' ),
			'email'          => __( 'Email', 'attackiq-inform-assessment' ),
			'company'        => __( 'Company', 'attackiq-inform-assessment' ),
			'sector'         => __( 'Sector', 'attackiq-inform-assessment' ),
			'overall_score'  => __( 'Overall', 'attackiq-inform-assessment' ),
			'maturity_level' => __( 'Maturity', 'attackiq-inform-assessment' ),
			'ctem_skipped'   => __( 'CTEM', 'attackiq-inform-assessment' ),
			'actions'        => __( 'Actions', 'attackiq-inform-assessment' ),
		);
	}

	public function get_sortable_columns() {
		return array(
			'created_at'    => array( 'created_at', true ),
			'email'         => array( 'email', false ),
			'sector'        => array( 'sector', false ),
			'overall_score' => array( 'overall_score', false ),
		);
	}

	public function prepare_items() {
		$columns  = $this->get_columns();
		$hidden   = array();
		$sortable = $this->get_sortable_columns();
		$this->_column_headers = array( $columns, $hidden, $sortable );

		$args = self::filters_from_request( $_GET );

		$result = AIQ_DB::query_submissions( $args );
		$this->items = $result['rows'];

		$per_page = max( 1, min( 100, intval( $args['per_page'] ) ) );
		$this->set_pagination_args( array(
			'total_items' => $result['total'],
			'per_page'    => $per_page,
			'total_pages' => max( 1, (int) ceil( $result['total'] / $per_page ) ),
		) );
	}

	/**
	 * Read filter values from a request array (typically $_GET) and
	 * normalize them into the AIQ_DB::query_submissions() shape.
	 * Public so the CSV exporter can reuse the exact same parsing.
	 */
	public static function filters_from_request( $request ) {
		$ctem = isset( $request['ctem_skipped'] ) && '' !== $request['ctem_skipped']
			? (bool) intval( $request['ctem_skipped'] )
			: null;

		return array(
			'date_from'    => isset( $request['date_from'] ) ? sanitize_text_field( $request['date_from'] ) : '',
			'date_to'      => isset( $request['date_to'] ) ? sanitize_text_field( $request['date_to'] ) : '',
			'min_score'    => isset( $request['min_score'] ) && '' !== $request['min_score'] ? floatval( $request['min_score'] ) : null,
			'max_score'    => isset( $request['max_score'] ) && '' !== $request['max_score'] ? floatval( $request['max_score'] ) : null,
			'sector'       => isset( $request['sector'] ) ? sanitize_text_field( $request['sector'] ) : '',
			'email'        => isset( $request['s'] ) ? sanitize_text_field( $request['s'] ) : '',
			'ctem_skipped' => $ctem,
			'page'         => isset( $request['paged'] ) ? max( 1, intval( $request['paged'] ) ) : 1,
			'per_page'     => 25,
			'orderby'      => isset( $request['orderby'] ) ? sanitize_key( $request['orderby'] ) : 'created_at',
			'order'        => isset( $request['order'] ) && strtoupper( $request['order'] ) === 'ASC' ? 'ASC' : 'DESC',
		);
	}

	public function column_default( $item, $column_name ) {
		if ( ! isset( $item[ $column_name ] ) ) {
			return '—';
		}
		$value = $item[ $column_name ];
		return $value === null || $value === '' ? '—' : esc_html( $value );
	}

	public function column_created_at( $item ) {
		return esc_html( $item['created_at'] );
	}

	public function column_email( $item ) {
		$email = $item['email'];
		if ( ! $email ) return '—';
		return '<a href="mailto:' . esc_attr( $email ) . '">' . esc_html( $email ) . '</a>';
	}

	public function column_overall_score( $item ) {
		if ( null === $item['overall_score'] || '' === $item['overall_score'] ) return '—';
		return esc_html( number_format( floatval( $item['overall_score'] ), 2 ) );
	}

	public function column_maturity_level( $item ) {
		$level = $item['maturity_level'];
		if ( null === $level || '' === $level ) return '—';
		$labels = array( 0 => 'None', 1 => 'Initial', 2 => 'Developing', 3 => 'Defined', 4 => 'Managed', 5 => 'Optimized' );
		return esc_html( ( isset( $labels[ (int) $level ] ) ? $labels[ (int) $level ] . ' (' . $level . ')' : $level ) );
	}

	public function column_ctem_skipped( $item ) {
		return ! empty( $item['ctem_skipped'] )
			? '<span style="color:#a00;">Skipped</span>'
			: '<span style="color:#080;">Included</span>';
	}

	public function column_actions( $item ) {
		$id = intval( $item['id'] );
		return sprintf(
			'<a href="#" class="aiq-view-json button button-small" data-id="%d">%s</a>',
			$id,
			esc_html__( 'View JSON', 'attackiq-inform-assessment' )
		);
	}

	public function no_items() {
		esc_html_e( 'No submissions match the current filters.', 'attackiq-inform-assessment' );
	}
}

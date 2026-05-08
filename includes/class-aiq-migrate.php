<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AIQ_Migrate {

	const PROGRESS_OPTION_KEY = 'aiq_backfill_progress';
	const BATCH_SIZE          = 50;

	public static function get_progress() {
		$default = array(
			'last_processed_id' => 0,
			'migrated_count'    => 0,
			'skipped_count'     => 0,
			'started_at'        => null,
			'completed_at'      => null,
		);

		$saved = get_option( self::PROGRESS_OPTION_KEY, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		return array_merge( $default, $saved );
	}

	public static function reset_progress() {
		delete_option( self::PROGRESS_OPTION_KEY );
	}

	public static function run_batch() {
		global $wpdb;

		$progress = self::get_progress();
		if ( null === $progress['started_at'] ) {
			$progress['started_at'] = current_time( 'mysql', true );
		}

		$post_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts}
				 WHERE post_type = 'aiq_submission'
				   AND ID > %d
				 ORDER BY ID ASC
				 LIMIT %d",
				intval( $progress['last_processed_id'] ),
				self::BATCH_SIZE
			)
		);

		if ( empty( $post_ids ) ) {
			$progress['completed_at'] = current_time( 'mysql', true );
			update_option( self::PROGRESS_OPTION_KEY, $progress, false );

			return array(
				'done'          => true,
				'processed'     => 0,
				'migrated'      => $progress['migrated_count'],
				'skipped'       => $progress['skipped_count'],
				'remaining'     => 0,
				'progress'      => $progress,
			);
		}

		$migrated_now = 0;
		$skipped_now  = 0;

		foreach ( $post_ids as $post_id ) {
			$post_id = intval( $post_id );

			if ( AIQ_DB::has_cpt_been_migrated( $post_id ) ) {
				$skipped_now++;
				$progress['skipped_count']++;
				$progress['last_processed_id'] = $post_id;
				continue;
			}

			$row = self::build_row_from_cpt( $post_id );
			if ( null === $row ) {
				$skipped_now++;
				$progress['skipped_count']++;
				$progress['last_processed_id'] = $post_id;
				continue;
			}

			$result = AIQ_DB::insert_submission( $row );
			if ( is_wp_error( $result ) ) {

				update_option( self::PROGRESS_OPTION_KEY, $progress, false );
				return array(
					'done'      => false,
					'processed' => $migrated_now + $skipped_now,
					'migrated'  => $progress['migrated_count'],
					'skipped'   => $progress['skipped_count'],
					'remaining' => self::count_remaining( $progress['last_processed_id'] ),
					'error'     => $result->get_error_message(),
					'progress'  => $progress,
				);
			}

			$migrated_now++;
			$progress['migrated_count']++;
			$progress['last_processed_id'] = $post_id;
		}

		update_option( self::PROGRESS_OPTION_KEY, $progress, false );

		$remaining = self::count_remaining( $progress['last_processed_id'] );

		return array(
			'done'      => 0 === $remaining,
			'processed' => $migrated_now + $skipped_now,
			'migrated'  => $progress['migrated_count'],
			'skipped'   => $progress['skipped_count'],
			'remaining' => $remaining,
			'progress'  => $progress,
		);
	}

	private static function build_row_from_cpt( $post_id ) {
		$post = get_post( $post_id );
		if ( ! $post ) {
			return null;
		}

		$answers = get_post_meta( $post_id, '_aiq_answers', true );
		if ( ! is_array( $answers ) ) {
			$answers = array();
		}

		$result = get_post_meta( $post_id, '_aiq_scores', true );
		$ip     = get_post_meta( $post_id, '_aiq_ip', true );

		$email = self::extract_email_from_title( $post->post_title );

		$overall_score = null;
		$section_scores = array();
		if ( is_array( $result ) ) {
			if ( isset( $result['overallScore'] ) ) {
				$overall_score = floatval( $result['overallScore'] );
			}
			if ( isset( $result['sectionScores'] ) && is_array( $result['sectionScores'] ) ) {
				foreach ( $result['sectionScores'] as $s ) {
					if ( isset( $s['id'] ) ) {
						$section_scores[ strtoupper( $s['id'] ) ] = isset( $s['score'] ) ? intval( $s['score'] ) : null;
					}
				}
			}
		}

		return array(
			'cpt_post_id'    => $post_id,
			'email'          => $email,
			'overall_score'  => $overall_score,
			'cti_score'      => isset( $section_scores['CTI'] ) ? $section_scores['CTI'] : null,
			'dm_score'       => isset( $section_scores['DM'] ) ? $section_scores['DM'] : null,
			'te_score'       => isset( $section_scores['TE'] ) ? $section_scores['TE'] : null,
			'ctem_score'     => isset( $section_scores['CTEM'] ) ? $section_scores['CTEM'] : null,
			'maturity_level' => isset( $result['maturityLevel'] ) ? intval( $result['maturityLevel'] ) : null,
			'answers'        => $answers,
			'ip'             => is_string( $ip ) ? $ip : null,
		);
	}

	private static function extract_email_from_title( $title ) {
		if ( ! is_string( $title ) ) {
			return null;
		}
		if ( preg_match( '/[a-z0-9_+\-.]+@[a-z0-9\-.]+\.[a-z]{2,}/i', $title, $m ) ) {
			return $m[0];
		}
		return null;
	}

	private static function count_remaining( $last_processed_id ) {
		global $wpdb;

		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->posts}
			 WHERE post_type = 'aiq_submission'
			   AND ID > %d",
			intval( $last_processed_id )
		) );
	}
}

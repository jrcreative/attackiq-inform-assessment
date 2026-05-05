<?php
/**
 * Phase 2 — API key authentication for the external read API.
 *
 * The plain key is shown to the admin exactly once at generation time, then
 * persisted as a SHA-256 hash. Subsequent requests carry the plain key in
 * the `X-AIQ-Key` header (or `?aiq_key=` query arg as a fallback for tools
 * that can't set headers); the auth helper hashes the inbound value and
 * compares against the stored hash with hash_equals().
 *
 * This is intentionally simpler than OAuth — the read API is internal-only
 * and the key can be rotated from the settings page at any time.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AIQ_Auth {

	const HASH_OPTION_KEY    = 'aiq_api_key_hash';
	const PREFIX_OPTION_KEY  = 'aiq_api_key_prefix';
	const CREATED_OPTION_KEY = 'aiq_api_key_created_at';
	const FLASH_TRANSIENT    = 'aiq_api_key_flash';

	/**
	 * Generate a new key, store its hash, and surface the plain value to the
	 * current admin via a transient so the settings page can show it once.
	 */
	public static function generate_and_store() {
		$plain  = self::generate_key();
		$prefix = substr( $plain, 0, 8 );
		$hash   = hash( 'sha256', $plain );

		update_option( self::HASH_OPTION_KEY, $hash, false );
		update_option( self::PREFIX_OPTION_KEY, $prefix, false );
		update_option( self::CREATED_OPTION_KEY, current_time( 'mysql', true ), false );

		// Stash the plaintext key for ~5 minutes so the next page render can
		// show it once. Tied to the current user so it doesn't leak across
		// sessions on multi-admin sites.
		set_transient( self::flash_key_for_current_user(), $plain, 5 * MINUTE_IN_SECONDS );

		return $plain;
	}

	public static function consume_flash() {
		$key = self::flash_key_for_current_user();
		$plain = get_transient( $key );
		if ( false !== $plain ) {
			delete_transient( $key );
			return $plain;
		}
		return null;
	}

	public static function has_key() {
		$hash = get_option( self::HASH_OPTION_KEY, '' );
		return ! empty( $hash );
	}

	public static function get_key_prefix() {
		return get_option( self::PREFIX_OPTION_KEY, '' );
	}

	public static function get_created_at() {
		return get_option( self::CREATED_OPTION_KEY, '' );
	}

	public static function revoke() {
		delete_option( self::HASH_OPTION_KEY );
		delete_option( self::PREFIX_OPTION_KEY );
		delete_option( self::CREATED_OPTION_KEY );
	}

	/**
	 * Permission callback for read endpoints.
	 *
	 * Accepts the key from either the `X-AIQ-Key` header or `aiq_key` query
	 * arg. Logged-in admins bypass the check so the same endpoints can be
	 * hit from the wp-admin list UI without provisioning a key.
	 */
	public static function rest_permission( $request ) {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		$stored_hash = get_option( self::HASH_OPTION_KEY, '' );
		if ( empty( $stored_hash ) ) {
			return new WP_Error( 'aiq_api_key_not_configured', 'API key has not been generated yet', array( 'status' => 401 ) );
		}

		$presented = $request->get_header( 'x_aiq_key' );
		if ( empty( $presented ) ) {
			$presented = $request->get_param( 'aiq_key' );
		}

		if ( empty( $presented ) ) {
			return new WP_Error( 'aiq_api_key_missing', 'Missing X-AIQ-Key header', array( 'status' => 401 ) );
		}

		$presented_hash = hash( 'sha256', (string) $presented );
		if ( ! hash_equals( $stored_hash, $presented_hash ) ) {
			return new WP_Error( 'aiq_api_key_invalid', 'Invalid API key', array( 'status' => 403 ) );
		}

		return true;
	}

	private static function generate_key() {
		// 32 bytes → 64 hex chars; first 8 chars used as the public prefix
		// so admins can identify which key is in use without revealing it.
		if ( function_exists( 'random_bytes' ) ) {
			return bin2hex( random_bytes( 32 ) );
		}
		return wp_generate_password( 64, false, false );
	}

	private static function flash_key_for_current_user() {
		return self::FLASH_TRANSIENT . '_' . get_current_user_id();
	}
}

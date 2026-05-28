<?php

use PHPUnit\Framework\TestCase;

/**
 * Tests unitaires ShippingController — matching codes postaux,
 * résolution prix par type de méthode, tiers poids/prix.
 */
class ShippingControllerTest extends TestCase {

    // ── postcodeMatches ─────────────────────────────────────────────────────

    public function test_postcode_exact_match(): void {
        $this->assertTrue(ShippingController::postcodeMatches('75001', ['75001', '75002']));
        $this->assertFalse(ShippingController::postcodeMatches('75003', ['75001', '75002']));
    }

    public function test_postcode_range_match(): void {
        $this->assertTrue(ShippingController::postcodeMatches('75001', ['75000-75999']));
        $this->assertTrue(ShippingController::postcodeMatches('75000', ['75000-75999'])); // borne inf
        $this->assertTrue(ShippingController::postcodeMatches('75999', ['75000-75999'])); // borne sup
        $this->assertFalse(ShippingController::postcodeMatches('76000', ['75000-75999']));
        $this->assertFalse(ShippingController::postcodeMatches('74999', ['75000-75999']));
    }

    public function test_postcode_prefix_wildcard(): void {
        $this->assertTrue(ShippingController::postcodeMatches('13001', ['13*']));
        $this->assertTrue(ShippingController::postcodeMatches('13800', ['13*']));
        $this->assertFalse(ShippingController::postcodeMatches('14000', ['13*']));
    }

    public function test_postcode_mixed_patterns(): void {
        $patterns = ['75000-75999', '92*', '30100'];
        $this->assertTrue(ShippingController::postcodeMatches('75010', $patterns));
        $this->assertTrue(ShippingController::postcodeMatches('92100', $patterns));
        $this->assertTrue(ShippingController::postcodeMatches('30100', $patterns));
        $this->assertFalse(ShippingController::postcodeMatches('69001', $patterns));
    }

    public function test_postcode_empty_pattern_ignored(): void {
        $this->assertFalse(ShippingController::postcodeMatches('75001', ['', '  ']));
    }

    public function test_postcode_no_match_empty_array(): void {
        $this->assertFalse(ShippingController::postcodeMatches('75001', []));
    }

    // ── resolvePrice (via reflection — private method) ──────────────────────

    private function callResolvePrice(array $method, array $ctx): ?int {
        $ref = new \ReflectionMethod(ShippingController::class, 'resolvePrice');
        $ref->setAccessible(true);
        return $ref->invoke(null, $method, $ctx);
    }

    public function test_price_type_free(): void {
        $result = $this->callResolvePrice(['type' => 'free'], ['subtotal_cents' => 5000, 'weight_grams' => 500]);
        $this->assertSame(0, $result);
    }

    public function test_price_type_flat_basic(): void {
        $method = ['type' => 'flat', 'price_cents' => 590, 'free_threshold_cents' => null];
        $result = $this->callResolvePrice($method, ['subtotal_cents' => 3000, 'weight_grams' => 500]);
        $this->assertSame(590, $result);
    }

    public function test_price_type_flat_free_above_threshold(): void {
        $method = ['type' => 'flat', 'price_cents' => 590, 'free_threshold_cents' => 5000];
        // Below threshold → pay
        $this->assertSame(590, $this->callResolvePrice($method, ['subtotal_cents' => 4999, 'weight_grams' => 0]));
        // At threshold → free
        $this->assertSame(0, $this->callResolvePrice($method, ['subtotal_cents' => 5000, 'weight_grams' => 0]));
        // Above threshold → free
        $this->assertSame(0, $this->callResolvePrice($method, ['subtotal_cents' => 10000, 'weight_grams' => 0]));
    }

    public function test_price_type_weight_tier_matching(): void {
        $method = [
            'type' => 'weight',
            'price_cents' => null,
            'free_threshold_cents' => null,
            'weight_tiers' => json_encode([
                ['min' => 0, 'max' => 1000, 'price_cents' => 500],
                ['min' => 1001, 'max' => 5000, 'price_cents' => 900],
                ['min' => 5001, 'max' => 30000, 'price_cents' => 1500],
            ]),
        ];
        $this->assertSame(500, $this->callResolvePrice($method, ['subtotal_cents' => 0, 'weight_grams' => 500]));
        $this->assertSame(900, $this->callResolvePrice($method, ['subtotal_cents' => 0, 'weight_grams' => 2000]));
        $this->assertSame(1500, $this->callResolvePrice($method, ['subtotal_cents' => 0, 'weight_grams' => 10000]));
    }

    public function test_price_type_weight_no_tier_match_returns_null(): void {
        $method = [
            'type' => 'weight',
            'price_cents' => null,
            'free_threshold_cents' => null,
            'weight_tiers' => json_encode([
                ['min' => 0, 'max' => 1000, 'price_cents' => 500],
            ]),
        ];
        // 2000g > max tier (1000) → null
        $this->assertNull($this->callResolvePrice($method, ['subtotal_cents' => 0, 'weight_grams' => 2000]));
    }

    public function test_price_type_price_tier_matching(): void {
        $method = [
            'type' => 'price',
            'price_cents' => null,
            'free_threshold_cents' => null,
            'weight_tiers' => json_encode([
                ['min' => 0, 'max' => 5000, 'price_cents' => 800],
                ['min' => 5001, 'max' => 20000, 'price_cents' => 500],
            ]),
        ];
        $this->assertSame(800, $this->callResolvePrice($method, ['subtotal_cents' => 3000, 'weight_grams' => 0]));
        $this->assertSame(500, $this->callResolvePrice($method, ['subtotal_cents' => 10000, 'weight_grams' => 0]));
    }

    public function test_price_unknown_type_returns_null(): void {
        $this->assertNull($this->callResolvePrice(['type' => 'unknown', 'price_cents' => null, 'free_threshold_cents' => null], ['subtotal_cents' => 0, 'weight_grams' => 0]));
    }

    // ── resolveTier (via reflection) ────────────────────────────────────────

    private function callResolveTier(array $tiers, int $value): ?int {
        $ref = new \ReflectionMethod(ShippingController::class, 'resolveTier');
        $ref->setAccessible(true);
        return $ref->invoke(null, $tiers, $value);
    }

    public function test_tier_boundary_exact_min(): void {
        $tiers = [
            ['min' => 0, 'max' => 1000, 'price_cents' => 500],
            ['min' => 1001, 'max' => 5000, 'price_cents' => 900],
        ];
        $this->assertSame(500, $this->callResolveTier($tiers, 0));
        $this->assertSame(500, $this->callResolveTier($tiers, 1000));
        $this->assertSame(900, $this->callResolveTier($tiers, 1001));
    }

    public function test_tier_boundary_exact_max(): void {
        $tiers = [['min' => 0, 'max' => 1000, 'price_cents' => 500]];
        $this->assertSame(500, $this->callResolveTier($tiers, 1000)); // inclusive
        $this->assertNull($this->callResolveTier($tiers, 1001));       // outside
    }

    public function test_tier_empty_returns_null(): void {
        $this->assertNull($this->callResolveTier([], 500));
    }
}

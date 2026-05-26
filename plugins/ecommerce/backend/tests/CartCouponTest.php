<?php

use PHPUnit\Framework\TestCase;

/**
 * Tests unitaires CartController — logique de calcul des coupons.
 * computeCouponDiscount est privée → accès via reflection.
 */
class CartCouponTest extends TestCase {

    private function callComputeCouponDiscount(array $coupon, int $subtotalTtc, array $items = []): int {
        $ref = new \ReflectionMethod(CartController::class, 'computeCouponDiscount');
        $ref->setAccessible(true);
        return $ref->invoke(null, $coupon, $subtotalTtc, $items);
    }

    // ── Coupon percent ──────────────────────────────────────────────────────

    public function test_percent_10_on_10000(): void {
        $coupon = ['type' => 'percent', 'percent' => 10.0, 'min_subtotal_cents' => null, 'value_cents' => null];
        $this->assertSame(1000, $this->callComputeCouponDiscount($coupon, 10000));
    }

    public function test_percent_50_on_9999(): void {
        $coupon = ['type' => 'percent', 'percent' => 50.0, 'min_subtotal_cents' => null, 'value_cents' => null];
        $this->assertSame(5000, $this->callComputeCouponDiscount($coupon, 9999)); // round(9999*0.5) = 5000
    }

    public function test_percent_100_full_discount(): void {
        $coupon = ['type' => 'percent', 'percent' => 100.0, 'min_subtotal_cents' => null, 'value_cents' => null];
        $this->assertSame(7500, $this->callComputeCouponDiscount($coupon, 7500));
    }

    public function test_percent_zero_no_discount(): void {
        $coupon = ['type' => 'percent', 'percent' => 0, 'min_subtotal_cents' => null, 'value_cents' => null];
        $this->assertSame(0, $this->callComputeCouponDiscount($coupon, 10000));
    }

    public function test_percent_negative_no_discount(): void {
        $coupon = ['type' => 'percent', 'percent' => -5, 'min_subtotal_cents' => null, 'value_cents' => null];
        $this->assertSame(0, $this->callComputeCouponDiscount($coupon, 10000));
    }

    public function test_percent_over_100_no_discount(): void {
        $coupon = ['type' => 'percent', 'percent' => 150, 'min_subtotal_cents' => null, 'value_cents' => null];
        $this->assertSame(0, $this->callComputeCouponDiscount($coupon, 10000));
    }

    // ── Coupon fixed ────────────────────────────────────────────────────────

    public function test_fixed_500_on_10000(): void {
        $coupon = ['type' => 'fixed', 'value_cents' => 500, 'percent' => null, 'min_subtotal_cents' => null];
        $this->assertSame(500, $this->callComputeCouponDiscount($coupon, 10000));
    }

    public function test_fixed_capped_at_subtotal(): void {
        $coupon = ['type' => 'fixed', 'value_cents' => 20000, 'percent' => null, 'min_subtotal_cents' => null];
        // Fixed 200€ mais subtotal 50€ → capped à 50€
        $this->assertSame(5000, $this->callComputeCouponDiscount($coupon, 5000));
    }

    public function test_fixed_exact_subtotal(): void {
        $coupon = ['type' => 'fixed', 'value_cents' => 5000, 'percent' => null, 'min_subtotal_cents' => null];
        $this->assertSame(5000, $this->callComputeCouponDiscount($coupon, 5000));
    }

    public function test_fixed_zero_value(): void {
        $coupon = ['type' => 'fixed', 'value_cents' => 0, 'percent' => null, 'min_subtotal_cents' => null];
        $this->assertSame(0, $this->callComputeCouponDiscount($coupon, 10000));
    }

    // ── Coupon free_shipping ────────────────────────────────────────────────

    public function test_free_shipping_returns_zero(): void {
        $coupon = ['type' => 'free_shipping', 'percent' => null, 'value_cents' => null, 'min_subtotal_cents' => null];
        $this->assertSame(0, $this->callComputeCouponDiscount($coupon, 10000));
    }

    // ── Min subtotal gate ───────────────────────────────────────────────────

    public function test_min_subtotal_not_reached(): void {
        $coupon = ['type' => 'percent', 'percent' => 10.0, 'min_subtotal_cents' => 5000, 'value_cents' => null];
        // Subtotal 30€ < min 50€ → pas de réduction
        $this->assertSame(0, $this->callComputeCouponDiscount($coupon, 3000));
    }

    public function test_min_subtotal_exact(): void {
        $coupon = ['type' => 'percent', 'percent' => 10.0, 'min_subtotal_cents' => 5000, 'value_cents' => null];
        // Subtotal 50€ = min 50€ → ok
        $this->assertSame(500, $this->callComputeCouponDiscount($coupon, 5000));
    }

    public function test_min_subtotal_above(): void {
        $coupon = ['type' => 'percent', 'percent' => 10.0, 'min_subtotal_cents' => 5000, 'value_cents' => null];
        $this->assertSame(1000, $this->callComputeCouponDiscount($coupon, 10000));
    }

    public function test_min_subtotal_null_always_applies(): void {
        $coupon = ['type' => 'fixed', 'value_cents' => 200, 'percent' => null, 'min_subtotal_cents' => null];
        $this->assertSame(200, $this->callComputeCouponDiscount($coupon, 1000));
    }

    // ── Unknown type ────────────────────────────────────────────────────────

    public function test_unknown_type_returns_zero(): void {
        $coupon = ['type' => 'bogo', 'percent' => null, 'value_cents' => null, 'min_subtotal_cents' => null];
        $this->assertSame(0, $this->callComputeCouponDiscount($coupon, 10000));
    }

    // ── Rounding ────────────────────────────────────────────────────────────

    public function test_percent_rounding_half_up(): void {
        // 33.33% de 100 cents = 33.33 → round = 33
        $coupon = ['type' => 'percent', 'percent' => 33.33, 'min_subtotal_cents' => null, 'value_cents' => null];
        $this->assertSame(33, $this->callComputeCouponDiscount($coupon, 100));
    }

    public function test_percent_rounding_exact_half(): void {
        // 15% de 333 = 49.95 → round = 50
        $coupon = ['type' => 'percent', 'percent' => 15.0, 'min_subtotal_cents' => null, 'value_cents' => null];
        $this->assertSame(50, $this->callComputeCouponDiscount($coupon, 333));
    }
}

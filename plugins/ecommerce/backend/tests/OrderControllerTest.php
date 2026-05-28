<?php

use PHPUnit\Framework\TestCase;

/**
 * Tests unitaires OrderController — validation adresses, format numéro
 * de commande, résolution prix shipping, extraction TVA des prix TTC.
 */
class OrderControllerTest extends TestCase {

    // ── validateAddress (via reflection) ────────────────────────────────────

    private function callValidateAddress($addr, string $type): array {
        $ref = new \ReflectionMethod(OrderController::class, 'validateAddress');
        $ref->setAccessible(true);
        return $ref->invoke(null, $addr, $type);
    }

    private function validBillingAddress(): array {
        return [
            'first_name' => 'Jean',
            'last_name' => 'Dupont',
            'address_line1' => '42 rue de la Paix',
            'postcode' => '75002',
            'city' => 'Paris',
            'country_code' => 'fr',
            'email' => 'jean@example.com',
        ];
    }

    public function test_valid_billing_address(): void {
        $result = $this->callValidateAddress($this->validBillingAddress(), 'billing');
        $this->assertSame('Jean', $result['first_name']);
        $this->assertSame('FR', $result['country_code']); // uppercased
        $this->assertSame('jean@example.com', $result['email']);
    }

    public function test_billing_requires_email(): void {
        $addr = $this->validBillingAddress();
        unset($addr['email']);
        $this->expectException(\RuntimeException::class);
        $this->callValidateAddress($addr, 'billing');
    }

    public function test_billing_invalid_email(): void {
        $addr = $this->validBillingAddress();
        $addr['email'] = 'not-an-email';
        $this->expectException(\RuntimeException::class);
        $this->callValidateAddress($addr, 'billing');
    }

    public function test_shipping_no_email_required(): void {
        $addr = $this->validBillingAddress();
        unset($addr['email']);
        // Shipping n'exige pas l'email
        $result = $this->callValidateAddress($addr, 'shipping');
        $this->assertSame('Jean', $result['first_name']);
    }

    public function test_missing_required_field_throws(): void {
        $required = ['first_name', 'last_name', 'address_line1', 'postcode', 'city', 'country_code'];
        foreach ($required as $field) {
            $addr = $this->validBillingAddress();
            unset($addr[$field]);
            try {
                $this->callValidateAddress($addr, 'shipping');
                $this->fail("Expected exception for missing field: $field");
            } catch (\RuntimeException $e) {
                $this->assertStringContainsString($field, $e->getMessage());
            }
        }
    }

    public function test_null_address_throws(): void {
        $this->expectException(\RuntimeException::class);
        $this->callValidateAddress(null, 'billing');
    }

    public function test_optional_fields_default_null(): void {
        $result = $this->callValidateAddress($this->validBillingAddress(), 'billing');
        $this->assertNull($result['company']);
        $this->assertNull($result['address_line2']);
        $this->assertNull($result['region']);
        $this->assertNull($result['phone']);
        $this->assertNull($result['vat_number']);
    }

    public function test_optional_fields_present(): void {
        $addr = $this->validBillingAddress();
        $addr['company'] = 'ACME SAS';
        $addr['phone'] = '+33612345678';
        $addr['vat_number'] = 'FR12345678901';
        $result = $this->callValidateAddress($addr, 'billing');
        $this->assertSame('ACME SAS', $result['company']);
        $this->assertSame('+33612345678', $result['phone']);
        $this->assertSame('FR12345678901', $result['vat_number']);
    }

    // ── generateOrderNumber (via reflection) ────────────────────────────────

    private function callGenerateOrderNumber(): string {
        $ref = new \ReflectionMethod(OrderController::class, 'generateOrderNumber');
        $ref->setAccessible(true);
        return $ref->invoke(null);
    }

    public function test_order_number_format(): void {
        $number = $this->callGenerateOrderNumber();
        // Format: CMD-yymmdd-XXXXXXXXXX (10 hex chars)
        $this->assertMatchesRegularExpression('/^CMD-\d{6}-[0-9A-F]{10}$/', $number);
    }

    public function test_order_number_contains_today_date(): void {
        $number = $this->callGenerateOrderNumber();
        $today = date('ymd');
        $this->assertStringContainsString("CMD-{$today}-", $number);
    }

    public function test_order_number_unique(): void {
        $numbers = [];
        for ($i = 0; $i < 100; $i++) {
            $numbers[] = $this->callGenerateOrderNumber();
        }
        // 100 numéros uniques (collision quasi impossible avec 10 hex chars)
        $this->assertCount(100, array_unique($numbers));
    }

    // ── resolveShippingPrice (via reflection) ───────────────────────────────

    private function callResolveShippingPrice(array $method, int $subtotal, array $items = [], array $custom = []): int {
        $ref = new \ReflectionMethod(OrderController::class, 'resolveShippingPrice');
        $ref->setAccessible(true);
        return $ref->invoke(null, $method, $subtotal, $items, $custom);
    }

    public function test_shipping_free_type(): void {
        $this->assertSame(0, $this->callResolveShippingPrice(['type' => 'free', 'price_cents' => 990, 'free_threshold_cents' => null, 'weight_tiers' => null], 5000));
    }

    public function test_shipping_flat_basic(): void {
        $method = ['type' => 'flat', 'price_cents' => 690, 'free_threshold_cents' => null, 'weight_tiers' => null];
        $this->assertSame(690, $this->callResolveShippingPrice($method, 3000));
    }

    public function test_shipping_flat_free_above_threshold(): void {
        $method = ['type' => 'flat', 'price_cents' => 690, 'free_threshold_cents' => 5000, 'weight_tiers' => null];
        $this->assertSame(690, $this->callResolveShippingPrice($method, 4999));
        $this->assertSame(0, $this->callResolveShippingPrice($method, 5000));
    }

    public function test_shipping_weight_tiers(): void {
        $method = [
            'type' => 'weight',
            'price_cents' => 0,
            'free_threshold_cents' => null,
            'weight_tiers' => json_encode([
                ['min' => 0, 'max' => 2000, 'price_cents' => 500],
                ['min' => 2001, 'max' => 10000, 'price_cents' => 1200],
            ]),
        ];
        $items = [
            ['weight_grams' => 500, 'quantity' => 2], // 1000g
        ];
        $this->assertSame(500, $this->callResolveShippingPrice($method, 0, $items));

        $items2 = [
            ['weight_grams' => 1500, 'quantity' => 2], // 3000g
        ];
        $this->assertSame(1200, $this->callResolveShippingPrice($method, 0, $items2));
    }

    public function test_shipping_fallback_to_price_cents(): void {
        // Type 'weight' avec aucun tier match → fallback price_cents
        $method = [
            'type' => 'weight',
            'price_cents' => 999,
            'free_threshold_cents' => null,
            'weight_tiers' => json_encode([
                ['min' => 0, 'max' => 100, 'price_cents' => 200],
            ]),
        ];
        $items = [['weight_grams' => 5000, 'quantity' => 1]]; // 5000g, hors tiers
        $this->assertSame(999, $this->callResolveShippingPrice($method, 0, $items));
    }

    // ── taxRate (via reflection) ────────────────────────────────────────────

    public function test_tax_extraction_from_ttc(): void {
        // Simule la logique d'extraction TVA dans create()
        // TTC=12000, taux 20% → HT = round(12000/1.2) = 10000 → tax = 2000
        $ttc = 12000;
        $rate = 20.0;
        $ht = (int) round($ttc / (1 + $rate / 100));
        $tax = $ttc - $ht;
        $this->assertSame(10000, $ht);
        $this->assertSame(2000, $tax);
    }

    public function test_tax_extraction_5_5_pct(): void {
        $ttc = 10550;
        $rate = 5.5;
        $ht = (int) round($ttc / (1 + $rate / 100));
        $tax = $ttc - $ht;
        // 10550 / 1.055 = 10000 → tax = 550
        $this->assertSame(10000, $ht);
        $this->assertSame(550, $tax);
    }

    public function test_tax_extraction_zero_rate(): void {
        $ttc = 10000;
        $rate = 0.0;
        $ht = (int) round($ttc / (1 + $rate / 100));
        $tax = $ttc - $ht;
        $this->assertSame(10000, $ht);
        $this->assertSame(0, $tax);
    }
}

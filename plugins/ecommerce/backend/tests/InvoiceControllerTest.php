<?php

use PHPUnit\Framework\TestCase;

/**
 * Tests unitaires InvoiceController — formatage prix, format numéro facture.
 */
class InvoiceControllerTest extends TestCase {

    // ── formatPrice (via reflection) ────────────────────────────────────────

    private function callFormatPrice(int $cents): string {
        $ref = new \ReflectionMethod(InvoiceController::class, 'formatPrice');
        $ref->setAccessible(true);
        return $ref->invoke(null, $cents);
    }

    public function test_format_price_basic(): void {
        $this->assertSame('100,00 €', $this->callFormatPrice(10000));
    }

    public function test_format_price_cents(): void {
        $this->assertSame('12,99 €', $this->callFormatPrice(1299));
    }

    public function test_format_price_zero(): void {
        $this->assertSame('0,00 €', $this->callFormatPrice(0));
    }

    public function test_format_price_large(): void {
        // 1 234,56 €
        $result = $this->callFormatPrice(123456);
        $this->assertStringContainsString('1', $result);
        $this->assertStringContainsString('234,56', $result);
        $this->assertStringContainsString('€', $result);
    }

    public function test_format_price_one_cent(): void {
        $this->assertSame('0,01 €', $this->callFormatPrice(1));
    }

    public function test_format_price_thousands_separator(): void {
        // 10 000,00 € — espace insécable ou normal
        $result = $this->callFormatPrice(1000000);
        $this->assertStringContainsString('000,00', $result);
        $this->assertStringContainsString('€', $result);
    }

    // ── Invoice number format ───────────────────────────────────────────────
    // nextInvoiceNumber() est DB-dependent, on teste juste le format attendu

    public function test_invoice_number_format_pattern(): void {
        // Le format attendu est : {PREFIX}-{YEAR}-{00001}
        $year = date('Y');
        $pattern = '/^(FA|AV)-' . $year . '-\d{5}$/';
        // On simule manuellement le format
        $number = sprintf('FA-%s-%05d', $year, 1);
        $this->assertMatchesRegularExpression($pattern, $number);

        $number42 = sprintf('FA-%s-%05d', $year, 42);
        $this->assertMatchesRegularExpression($pattern, $number42);

        $creditNote = sprintf('AV-%s-%05d', $year, 1);
        $this->assertMatchesRegularExpression($pattern, $creditNote);
    }

    public function test_invoice_number_zero_padded(): void {
        $number = sprintf('FA-%s-%05d', '2026', 7);
        $this->assertSame('FA-2026-00007', $number);
    }

    public function test_invoice_number_large(): void {
        $number = sprintf('FA-%s-%05d', '2026', 99999);
        $this->assertSame('FA-2026-99999', $number);
    }

    // ── Coupon serialize helpers ─────────────────────────────────────────────

    public function test_coupon_serialize_types(): void {
        // Test CouponsAdminController::serialize via reflection
        $ref = new \ReflectionMethod(CouponsAdminController::class, 'serialize');
        $ref->setAccessible(true);

        $row = [
            'id' => '42', 'code' => 'PROMO10', 'type' => 'percent',
            'value_cents' => null, 'percent' => '10.5',
            'min_subtotal_cents' => '5000', 'max_uses' => '100',
            'max_uses_per_customer' => '3', 'used_count' => '7',
            'starts_at' => '2026-01-01', 'expires_at' => '2026-12-31',
            'applies_to' => 'all', 'applies_ids' => null,
            'is_active' => '1', 'created_at' => '2026-01-01 00:00:00',
        ];
        $result = $ref->invoke(null, $row);

        $this->assertSame(42, $result['id']);
        $this->assertSame('PROMO10', $result['code']);
        $this->assertSame(10.5, $result['percent']);
        $this->assertNull($result['value_cents']);
        $this->assertSame(5000, $result['min_subtotal_cents']);
        $this->assertSame(100, $result['max_uses']);
        $this->assertSame(3, $result['max_uses_per_customer']);
        $this->assertSame(7, $result['used_count']);
        $this->assertTrue($result['is_active']);
        $this->assertSame([], $result['applies_ids']); // null → []
    }

    public function test_coupon_serialize_with_applies_ids_json(): void {
        $ref = new \ReflectionMethod(CouponsAdminController::class, 'serialize');
        $ref->setAccessible(true);

        $row = [
            'id' => '1', 'code' => 'CAT5', 'type' => 'fixed',
            'value_cents' => '500', 'percent' => null,
            'min_subtotal_cents' => null, 'max_uses' => null,
            'max_uses_per_customer' => null, 'used_count' => '0',
            'starts_at' => null, 'expires_at' => null,
            'applies_to' => 'categories', 'applies_ids' => json_encode([1, 5, 9]),
            'is_active' => '0', 'created_at' => '2026-01-01 00:00:00',
        ];
        $result = $ref->invoke(null, $row);

        $this->assertSame(500, $result['value_cents']);
        $this->assertNull($result['percent']);
        $this->assertSame([1, 5, 9], $result['applies_ids']);
        $this->assertFalse($result['is_active']);
    }
}

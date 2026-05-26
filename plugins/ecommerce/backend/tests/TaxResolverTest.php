<?php

use PHPUnit\Framework\TestCase;

/**
 * Tests unitaires TaxResolver — règles TVA selon contexte client/pays.
 *
 * Note : isFranchise() est DB-dependent → on teste uniquement les cas
 * non-franchise (résultat par défaut = false quand DB indisponible).
 */
class TaxResolverTest extends TestCase {

    // ── resolve() — cas domestiques ─────────────────────────────────────────

    public function test_particulier_fr_tva_normale(): void {
        $ctx = TaxResolver::resolve('FR', false);
        $this->assertFalse($ctx['exempt']);
        $this->assertSame(1.0, $ctx['rate_modifier']);
        $this->assertSame('domestic', $ctx['reason']);
    }

    public function test_pro_fr_tva_normale(): void {
        $ctx = TaxResolver::resolve('FR', true, 'FR12345678901');
        $this->assertFalse($ctx['exempt']);
        $this->assertSame('domestic', $ctx['reason']);
    }

    public function test_particulier_sans_pays_tva_normale(): void {
        $ctx = TaxResolver::resolve('', false);
        $this->assertFalse($ctx['exempt']);
    }

    // ── resolve() — pro UE (autoliquidation) ────────────────────────────────

    public function test_pro_ue_avec_vat_autoliquidation(): void {
        $ctx = TaxResolver::resolve('DE', true, 'DE123456789');
        $this->assertTrue($ctx['exempt']);
        $this->assertSame(0.0, $ctx['rate_modifier']);
        $this->assertSame('eu_reverse_charge', $ctx['reason']);
        $this->assertStringContainsString('Autoliquidation', $ctx['mention']);
    }

    public function test_pro_ue_sans_vat_tva_normale(): void {
        $ctx = TaxResolver::resolve('DE', true, null);
        $this->assertFalse($ctx['exempt']);
        $this->assertSame('domestic', $ctx['reason']);
    }

    public function test_pro_ue_vat_invalide_tva_normale(): void {
        $ctx = TaxResolver::resolve('IT', true, 'X'); // trop court
        $this->assertFalse($ctx['exempt']);
    }

    public function test_pro_ue_tous_pays_reconnus(): void {
        $euCountries = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','DE','GR','HU','IE','IT',
            'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
        foreach ($euCountries as $cc) {
            $ctx = TaxResolver::resolve($cc, true, $cc . '123456789');
            $this->assertTrue($ctx['exempt'], "Pays UE {$cc} devrait être exempt avec TVA valide");
        }
    }

    // ── resolve() — pro hors UE (export) ────────────────────────────────────

    public function test_pro_hors_ue_export_exonere(): void {
        $ctx = TaxResolver::resolve('US', true, null);
        $this->assertTrue($ctx['exempt']);
        $this->assertSame('export', $ctx['reason']);
        $this->assertStringContainsString('262 I', $ctx['mention']);
    }

    public function test_pro_suisse_export(): void {
        $ctx = TaxResolver::resolve('CH', true);
        $this->assertTrue($ctx['exempt']);
        $this->assertSame('export', $ctx['reason']);
    }

    public function test_pro_uk_post_brexit_export(): void {
        $ctx = TaxResolver::resolve('GB', true);
        $this->assertTrue($ctx['exempt']);
        $this->assertSame('export', $ctx['reason']);
    }

    // ── resolve() — particulier étranger → TVA normale ──────────────────────

    public function test_particulier_ue_tva_normale(): void {
        $ctx = TaxResolver::resolve('DE', false);
        $this->assertFalse($ctx['exempt']);
        $this->assertSame('domestic', $ctx['reason']);
    }

    public function test_particulier_hors_ue_tva_normale(): void {
        // Nota : un particulier hors UE = TVA FR (seuil B2C OSS non géré ici)
        $ctx = TaxResolver::resolve('US', false);
        $this->assertFalse($ctx['exempt']);
    }

    // ── resolve() — normalisation pays ──────────────────────────────────────

    public function test_country_code_trimmed_and_uppercased(): void {
        $ctx = TaxResolver::resolve(' fr ', true);
        $this->assertSame('domestic', $ctx['reason']); // FR → normal
    }

    // ── isValidEuVat (via reflection) ───────────────────────────────────────

    private function callIsValidEuVat(?string $vat): bool {
        $ref = new \ReflectionMethod(TaxResolver::class, 'isValidEuVat');
        $ref->setAccessible(true);
        return $ref->invoke(null, $vat);
    }

    public function test_vat_null_invalide(): void {
        $this->assertFalse($this->callIsValidEuVat(null));
    }

    public function test_vat_empty_invalide(): void {
        $this->assertFalse($this->callIsValidEuVat(''));
    }

    public function test_vat_fr_valide(): void {
        $this->assertTrue($this->callIsValidEuVat('FR12345678901'));
    }

    public function test_vat_de_valide(): void {
        $this->assertTrue($this->callIsValidEuVat('DE123456789'));
    }

    public function test_vat_with_spaces_trimmed(): void {
        $this->assertTrue($this->callIsValidEuVat('FR 123 456 789 01'));
    }

    public function test_vat_trop_court_invalide(): void {
        $this->assertFalse($this->callIsValidEuVat('FR1'));
    }

    public function test_vat_sans_prefixe_pays_invalide(): void {
        $this->assertFalse($this->callIsValidEuVat('12345678901'));
    }

    // ── computeTax ──────────────────────────────────────────────────────────

    public function test_compute_tax_normal_20pct(): void {
        $ctx = ['exempt' => false, 'rate_modifier' => 1.0, 'mention' => '', 'reason' => 'domestic'];
        $result = TaxResolver::computeTax(12000, 20.0, $ctx);
        // TTC=12000, TVA=12000 - 12000/1.2 = 12000 - 10000 = 2000
        $this->assertSame(10000, $result['ht']);
        $this->assertSame(2000, $result['tax']);
        $this->assertSame(12000, $result['total']);
        $this->assertSame(20.0, $result['effective_rate']);
    }

    public function test_compute_tax_exempt(): void {
        $ctx = ['exempt' => true, 'rate_modifier' => 0.0, 'mention' => 'Autoliquidation', 'reason' => 'eu_reverse_charge'];
        $result = TaxResolver::computeTax(12000, 20.0, $ctx);
        $this->assertSame(12000, $result['ht']); // TTC = HT (exonéré)
        $this->assertSame(0, $result['tax']);
        $this->assertSame(0.0, $result['effective_rate']);
    }

    public function test_compute_tax_reduced_rate_10pct(): void {
        $ctx = ['exempt' => false, 'rate_modifier' => 1.0, 'mention' => '', 'reason' => 'domestic'];
        $result = TaxResolver::computeTax(11000, 10.0, $ctx);
        // 11000 / 1.1 = 10000 → tax = 1000
        $this->assertSame(10000, $result['ht']);
        $this->assertSame(1000, $result['tax']);
    }

    public function test_compute_tax_zero_amount(): void {
        $ctx = ['exempt' => false, 'rate_modifier' => 1.0, 'mention' => '', 'reason' => 'domestic'];
        $result = TaxResolver::computeTax(0, 20.0, $ctx);
        $this->assertSame(0, $result['ht']);
        $this->assertSame(0, $result['tax']);
    }

    public function test_compute_tax_rounding_precision(): void {
        $ctx = ['exempt' => false, 'rate_modifier' => 1.0, 'mention' => '', 'reason' => 'domestic'];
        // 999 / 1.2 = 832.5 → round = 833 → tax = 999 - 833 = 166 (not 167)
        $result = TaxResolver::computeTax(999, 20.0, $ctx);
        $this->assertSame(999, $result['ht'] + $result['tax']); // HT + TVA = TTC
    }
}

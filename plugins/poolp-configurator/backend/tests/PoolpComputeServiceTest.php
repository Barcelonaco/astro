<?php

use PHPUnit\Framework\TestCase;

/**
 * Tests unitaires du moteur métier POOLP — couvre les règles CDC §3 (calculs
 * hydrauliques, exclusions box, traitements compatibles) et §4.2 (matching
 * code postal).
 *
 * Les méthodes qui touchent la base de données (pickBox, pickEquipments,
 * resolveDeliveryZone, computeTotals avec settings) sont testées séparément
 * via PoolpComputeServiceIntegrationTest qui requiert une DB peuplée.
 */
class PoolpComputeServiceTest extends TestCase {

    // ─── Calculs hydrauliques (CDC §3.2 étape 2) ─────────────────────────────

    public function test_volume_36m3_box_S_compatible(): void {
        $h = PoolpComputeService::computeHydraulic(['longueur' => 6, 'largeur' => 4, 'hauteur' => 1.5]);
        $this->assertSame(36.0, $h['volume']);
        $this->assertSame(7.2, $h['debit']);   // 36 / 5
        $this->assertSame(24.0, $h['surface']);
    }

    public function test_volume_50m3_box_M(): void {
        $h = PoolpComputeService::computeHydraulic(['longueur' => 8, 'largeur' => 4, 'hauteur' => 1.56]);
        // 8*4*1.56 = 49.92 ≈ 50
        $this->assertEqualsWithDelta(50, $h['volume'], 0.1);
    }

    public function test_volume_75m3_box_L(): void {
        $h = PoolpComputeService::computeHydraulic(['longueur' => 10, 'largeur' => 5, 'hauteur' => 1.5]);
        $this->assertSame(75.0, $h['volume']);
        $this->assertSame(15.0, $h['debit']);  // 75 / 5
    }

    public function test_skimmers_arrondi_superieur(): void {
        // surface = 6.5 * 4 = 26 → 26/25 = 1.04 → ceil = 2
        $h = PoolpComputeService::computeHydraulic(['longueur' => 6.5, 'largeur' => 4, 'hauteur' => 1.5]);
        $this->assertSame(2, $h['nb_skimmers']);
    }

    public function test_skimmers_max_surface_vs_debit(): void {
        // grand bassin peu profond : surface gouverne
        // 16x4 = 64 m² → 64/25 = 2.56 → ceil 3
        // volume 64*1 = 64, débit = 12.8 → 12.8/6 = 2.13 → ceil 3
        // max(3,3) = 3 (surface domine ici)
        $h = PoolpComputeService::computeHydraulic(['longueur' => 16, 'largeur' => 4, 'hauteur' => 1]);
        $this->assertSame(3, $h['nb_skimmers']);

        // bassin profond, surface modeste : débit gouverne
        // 6x4 = 24 m² → 24/25 = 0.96 → ceil 1
        // volume 24*2 = 48, débit = 9.6 → 9.6/6 = 1.6 → ceil 2
        // max(1, 2) = 2 (débit domine)
        $h2 = PoolpComputeService::computeHydraulic(['longueur' => 6, 'largeur' => 4, 'hauteur' => 2]);
        $this->assertSame(2, $h2['nb_skimmers']);
    }

    public function test_bondes_volet_immerge_double(): void {
        $base = ['longueur' => 8, 'largeur' => 4, 'hauteur' => 1.5];
        $sansVolet = PoolpComputeService::computeHydraulic($base + ['volet_immerge' => false]);
        $avecVolet = PoolpComputeService::computeHydraulic($base + ['volet_immerge' => true]);
        $this->assertSame(1, $sansVolet['nb_bondes']);
        $this->assertSame(2, $avecVolet['nb_bondes']);
    }

    public function test_refoulements_plus_un_si_volet_immerge(): void {
        $base = ['longueur' => 8, 'largeur' => 4, 'hauteur' => 1.5];
        $sansVolet = PoolpComputeService::computeHydraulic($base + ['volet_immerge' => false]);
        $avecVolet = PoolpComputeService::computeHydraulic($base + ['volet_immerge' => true]);
        // CDC : refoulements = nb_skimmers + 1 (volet) — la bonde de fond est comptée séparément
        $this->assertSame($sansVolet['nb_skimmers'], $sansVolet['nb_refoulements']);
        $this->assertSame($avecVolet['nb_skimmers'] + 1, $avecVolet['nb_refoulements']);
    }

    // ─── Règles d'exclusion box (CDC §3.5) ──────────────────────────────────

    public function test_uv_exclut_box_S(): void {
        $excluded = PoolpComputeService::excludedBoxes(['traitement' => 'uv_oxygene'], 30);
        $this->assertContains('S', $excluded);
    }

    public function test_bypass_pac_exclut_box_S(): void {
        $excluded = PoolpComputeService::excludedBoxes(['bypass_pac' => true], 30);
        $this->assertContains('S', $excluded);
    }

    public function test_volume_37_aucune_exclusion_de_volume(): void {
        $excluded = PoolpComputeService::excludedBoxes([], 37);
        // Aucune exclusion liée au volume car 37 ≤ 37 (limite Box S)
        $this->assertNotContains('S', $excluded);
        $this->assertNotContains('M', $excluded);
    }

    public function test_volume_50_exclut_box_S(): void {
        $excluded = PoolpComputeService::excludedBoxes([], 50);
        $this->assertContains('S', $excluded);
        $this->assertNotContains('M', $excluded);
    }

    public function test_volume_70_exclut_box_S_et_M(): void {
        $excluded = PoolpComputeService::excludedBoxes([], 70);
        $this->assertContains('S', $excluded);
        $this->assertContains('M', $excluded);
    }

    public function test_volume_75_exclut_box_S_et_M_mais_L_autorise(): void {
        $excluded = PoolpComputeService::excludedBoxes([], 75);
        $this->assertContains('S', $excluded);
        $this->assertContains('M', $excluded);
        $this->assertNotContains('L', $excluded);
    }

    public function test_uv_et_bypass_pac_n_excluent_S_qu_une_fois(): void {
        $excluded = PoolpComputeService::excludedBoxes(['traitement' => 'uv_oxygene', 'bypass_pac' => true], 50);
        // S apparait à cause des 3 règles, mais on ne veut qu'un seul "S"
        $countS = count(array_filter($excluded, fn($e) => $e === 'S'));
        $this->assertSame(1, $countS);
    }

    // ─── Bassin couvert + traitement (CDC §3.2 étape 1) ─────────────────────

    public function test_bassin_decouvert_tous_traitements_autorises(): void {
        $allowed = PoolpComputeService::allowedTreatments(['bassin_couvert' => false]);
        $this->assertContains('electrolyse_ph', $allowed);
        $this->assertContains('electrolyse_ph_redox', $allowed);
        $this->assertContains('uv_oxygene', $allowed);
    }

    public function test_bassin_couvert_pas_d_electrolyse_seule(): void {
        $allowed = PoolpComputeService::allowedTreatments(['bassin_couvert' => true]);
        $this->assertNotContains('electrolyse_ph', $allowed);
        // CDC : électrolyse+REDOX OK (coupure auto) et UV+oxygène OK (pas de chlore)
        $this->assertContains('electrolyse_ph_redox', $allowed);
        $this->assertContains('uv_oxygene', $allowed);
        $this->assertContains('regul_ph', $allowed);
    }

    // ─── Coffret programmation auto (CDC §3.2 étape 4) ──────────────────────

    public function test_pompe_mono_choisit_bluetooth(): void {
        $this->assertSame('bluetooth', PoolpComputeService::deduceCoffretProgrammation('mono'));
    }

    public function test_pompe_variable_choisit_wifi(): void {
        $this->assertSame('wifi', PoolpComputeService::deduceCoffretProgrammation('variable'));
    }

    // ─── Logistique : matching code postal (CDC §4.2) ───────────────────────

    public function test_postal_code_match_exact(): void {
        $this->assertTrue(PoolpComputeService::postalCodeMatches('30000', ['30000', '34000']));
        $this->assertFalse(PoolpComputeService::postalCodeMatches('30000', ['34000', '13000']));
    }

    public function test_postal_code_match_range(): void {
        $this->assertTrue(PoolpComputeService::postalCodeMatches('30500', ['30000-30999']));
        $this->assertTrue(PoolpComputeService::postalCodeMatches('30000', ['30000-30999']));
        $this->assertTrue(PoolpComputeService::postalCodeMatches('30999', ['30000-30999']));
        $this->assertFalse(PoolpComputeService::postalCodeMatches('31000', ['30000-30999']));
    }

    public function test_postal_code_match_prefix(): void {
        $this->assertTrue(PoolpComputeService::postalCodeMatches('13800', ['13*']));
        $this->assertTrue(PoolpComputeService::postalCodeMatches('13000', ['13*']));
        $this->assertFalse(PoolpComputeService::postalCodeMatches('14000', ['13*']));
    }

    public function test_postal_code_match_multi_patterns(): void {
        $patterns = ['30000-30999', '34000-34999', '13*'];
        $this->assertTrue(PoolpComputeService::postalCodeMatches('30500', $patterns));
        $this->assertTrue(PoolpComputeService::postalCodeMatches('34800', $patterns));
        $this->assertTrue(PoolpComputeService::postalCodeMatches('13002', $patterns));
        $this->assertFalse(PoolpComputeService::postalCodeMatches('75001', $patterns));
    }

    // ─── Validation des inputs ──────────────────────────────────────────────

    public function test_validation_dimensions_obligatoires(): void {
        $errors = PoolpComputeService::validateInput([]);
        $this->assertArrayHasKey('longueur', $errors);
        $this->assertArrayHasKey('largeur', $errors);
        $this->assertArrayHasKey('hauteur', $errors);
    }

    public function test_validation_dimensions_positives(): void {
        $errors = PoolpComputeService::validateInput(['longueur' => 0, 'largeur' => -5, 'hauteur' => 1.5]);
        $this->assertArrayHasKey('longueur', $errors);
        $this->assertArrayHasKey('largeur', $errors);
        $this->assertArrayNotHasKey('hauteur', $errors);
    }

    public function test_validation_traitement_invalide(): void {
        $errors = PoolpComputeService::validateInput([
            'longueur' => 8, 'largeur' => 4, 'hauteur' => 1.5,
            'traitement' => 'wat',
        ]);
        $this->assertArrayHasKey('traitement', $errors);
    }

    public function test_validation_filtre_invalide(): void {
        $errors = PoolpComputeService::validateInput([
            'longueur' => 8, 'largeur' => 4, 'hauteur' => 1.5,
            'filtre' => 'magnetique',
        ]);
        $this->assertArrayHasKey('filtre', $errors);
    }

    public function test_validation_inputs_valides(): void {
        $errors = PoolpComputeService::validateInput([
            'longueur' => 8, 'largeur' => 4, 'hauteur' => 1.5,
            'filtre' => 'sable', 'pompe' => 'variable', 'traitement' => 'electrolyse_ph',
        ]);
        $this->assertEmpty($errors);
    }

    // ─── Calcul totaux (sans DB) ────────────────────────────────────────────

    public function test_totaux_simple_non_pro(): void {
        $box = ['prix_base_ttc' => 7990, 'prix_base_pro_ht' => 6658];
        $equipements = [
            ['prix_ttc' => 990, 'prix_pro_ht' => 825],
            ['prix_ttc' => 590, 'prix_pro_ht' => 491],
        ];
        $finition = ['prix_supplement_ttc' => 90, 'prix_supplement_pro_ht' => 75];
        $livraison = ['fee_ttc' => 190, 'fee_pro_ht' => 158];

        $t = PoolpComputeService::computeTotals($box, $equipements, $finition, $livraison, false, 0);
        $this->assertSame(9850.0, $t['ttc']); // 7990 + 990 + 590 + 90 + 190
        $this->assertNull($t['pro_ht_remise']);
    }

    public function test_totaux_pro_avec_remise_15pct(): void {
        $box = ['prix_base_ttc' => 7990, 'prix_base_pro_ht' => 6658];
        $equipements = [];
        $finition = null;
        $livraison = null;

        $t = PoolpComputeService::computeTotals($box, $equipements, $finition, $livraison, true, 0.15);
        $this->assertSame(7990.0, $t['ttc']);
        // pro HT brut = 6658 → -15% = 5659.30
        $this->assertSame(5659.30, $t['pro_ht_remise']);
        $this->assertSame(0.15, $t['discount_rate']);
    }
}

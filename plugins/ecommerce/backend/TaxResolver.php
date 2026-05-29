<?php
/**
 * TaxResolver — determine le taux de TVA effectif selon le contexte client.
 *
 * Regles 2026 :
 *   1. Client pro FR           → TVA normale (20%)
 *   2. Client pro UE + n° TVA  → 0% (autoliquidation art. 283-2 CGI)
 *   3. Client pro hors UE      → 0% (export exonere art. 262 I CGI)
 *   4. Particulier              → TVA normale
 *   5. Franchise micro-entreprise → 0% partout (art. 293 B CGI)
 *
 * Usage :
 *   $ctx = TaxResolver::resolve($billingCountry, $isPro, $vatNumber);
 *   // $ctx = ['rate_modifier' => 1.0|0.0, 'mention' => '...', 'reason' => '...']
 */
class TaxResolver
{

    /** Codes ISO 3166-1 alpha-2 des pays UE (2026). */
    private const EU_COUNTRIES = [
        'AT',
        'BE',
        'BG',
        'HR',
        'CY',
        'CZ',
        'DK',
        'EE',
        'FI',
        'DE',
        'GR',
        'HU',
        'IE',
        'IT',
        'LV',
        'LT',
        'LU',
        'MT',
        'NL',
        'PL',
        'PT',
        'RO',
        'SK',
        'SI',
        'ES',
        'SE',
        // FR exclu : traite comme cas domestique
    ];

    /**
     * Resout le contexte TVA.
     *
     * @param string      $billingCountry  Code pays ISO facturation (ex: 'FR', 'DE', 'US')
     * @param bool        $isPro           Client professionnel approuvé ?
     * @param string|null $vatNumber       Numero TVA intracommunautaire (ex: 'FR12345678901')
     * @return array{rate_modifier: float, mention: string, reason: string, exempt: bool}
     */
    public static function resolve(string $billingCountry, bool $isPro, ?string $vatNumber = null): array
    {
        $country = strtoupper(trim($billingCountry));

        // Franchise micro-entreprise : check setting
        if (self::isFranchise()) {
            return [
                'rate_modifier' => 0.0,
                'exempt' => true,
                'mention' => 'TVA non applicable, article 293 B du CGI',
                'reason' => 'franchise_micro',
            ];
        }

        // Particulier ou pro sans pays → TVA normale
        if (!$isPro || $country === '') {
            return self::normalTax();
        }

        // Pro France → TVA normale
        if ($country === 'FR') {
            return self::normalTax();
        }

        // Pro UE (hors FR) avec n° TVA valide → autoliquidation
        if (in_array($country, self::EU_COUNTRIES, true)) {
            if (self::isValidEuVat($vatNumber)) {
                return [
                    'rate_modifier' => 0.0,
                    'exempt' => true,
                    'mention' => 'Autoliquidation — Exoneration de TVA, article 262 ter I du CGI',
                    'reason' => 'eu_reverse_charge',
                ];
            }
            // Pro UE sans n° TVA valide → TVA normale (comme un particulier)
            return self::normalTax();
        }

        // Pro hors UE → export exonere
        return [
            'rate_modifier' => 0.0,
            'exempt' => true,
            'mention' => 'Exoneration de TVA — Article 262 I du CGI',
            'reason' => 'export',
        ];
    }

    /** TVA normale (pas d'exoneration). */
    private static function normalTax(): array
    {
        return [
            'rate_modifier' => 1.0,
            'exempt' => false,
            'mention' => '',
            'reason' => 'domestic',
        ];
    }

    /** Verifie basiquement qu'un n° TVA intracommunautaire est fourni et non vide. */
    private static function isValidEuVat(?string $vat): bool
    {
        if (!$vat)
            return false;
        $vat = preg_replace('/[\s\-.]/', '', $vat);
        // Format minimal : 2 lettres + 2-13 chiffres/lettres
        return (bool) preg_match('/^[A-Z]{2}[0-9A-Z]{2,13}$/i', $vat);
    }

    /** Verifie si le shop est en franchise de base (micro-entreprise). */
    private static function isFranchise(): bool
    {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'shop_franchise_tva' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            return $row && $row['setting_value'] === '1';
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Applique le contexte TVA a un montant TTC.
     * Si exempt → TVA = 0, montant inchange (considere HT = TTC).
     * Si normal → extrait la TVA du TTC comme avant.
     */
    public static function computeTax(int $ttcCents, float $nominalRate, array $taxContext): array
    {
        if ($taxContext['exempt']) {
            // Exonere : prix = HT, pas de TVA
            return ['ht' => $ttcCents, 'tax' => 0, 'total' => $ttcCents, 'effective_rate' => 0.0];
        }
        // Normal : extraire TVA du TTC
        $tax = (int) round($ttcCents - $ttcCents / (1 + $nominalRate / 100));
        $ht = $ttcCents - $tax;
        return ['ht' => $ht, 'tax' => $tax, 'total' => $ttcCents, 'effective_rate' => $nominalRate];
    }
}

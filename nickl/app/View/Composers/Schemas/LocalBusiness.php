<?php

namespace App\View\Composers\Schemas;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class LocalBusiness extends Composer
{
    /**
     * Vues associées à ce Composer.
     */


    protected static $views = [
        'components.schema-local-business',
    ];
    private $schema;

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        $this->schema = get_field('flexible_schemas')[0] ?? [];
        return [
            'name' => $this->getName($this->schema),
            'phone' => $this->getPhone($this->schema),
            'hours' => $this->getOpening($this->schema),
            'price' => $this->getRangePrice($this->schema),
            'address' => $this->getAddress($this->schema),
            'socials' => $this->getSocials($this->schema),
        ];
    }
    protected function getName($schema)
    {
        return $schema['schema_name'] ?? '';
    }
    protected function getPhone($schema)
    {
        return $schema['schema_phone'] ?? '';
    }
    protected function getOpening($schema)
    {
        return $schema['schema_opening'] ?? '';
    }
    protected function getRangePrice($schema)
    {
        return $schema['schema_priceRange'] ?? '';
    }
    protected function getAddress($schema)
    {
        $address = [
            'address' => $schema['schema_address']['address'] ?? '',
            'lat' => $schema['schema_address']['lat'] ?? '',
            'lng' => $schema['schema_address']['lng'] ?? '',
            'city' => $schema['schema_address']['city'] ?? '',
            'state' => $schema['schema_address']['state'] ?? '',
            'post_code' => $schema['schema_address']['post_code'] ?? '',
            'country' => $schema['schema_address']['country'] ?? '',
            'country_short' => $schema['schema_address']['country_short'] ?? ''
        ];
        return $address;
    }
    protected function getSocials($schema)
    {
        $socials = [
            'facebook' => $schema['facebook'] ?? '',
            'instagram' => $schema['instagram'] ?? '',
            'twitter' => $schema['twitter'] ?? '',
            'tiktok' => $schema['tiktok'] ?? '',
            'youtube' => $schema['youtube'] ?? '',
            'tripadvisor' => $schema['tripadvisor'] ?? '',
            'pinterest' => $schema['pinterest'] ?? '',
            'linkedin' => $schema['linkedin'] ?? ''
        ];
        return $socials;
    }
}

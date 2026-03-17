<?php

namespace App\Taxonomy;

use Bandco\Core\TaxoRegister;
use App\Posttype\CptNews;

class TaxoNewsCategory extends TaxoRegister
{
    protected string $slug = 'categorie';
    protected string $plural = 'Catégories d\'actualités';
    protected string $singular = 'Catégorie d\'actualités';
    protected bool $isFemale = true;

    public function hooks()
    {
        $cptSlug = new CptNews();
        $this->posttype = [
            $cptSlug->getSlug(),
        ];

        parent::hooks();

        add_action("{$this->slug}_edit_form_fields", [$this, 'editLongDescriptionField']);
        add_action("edited_{$this->slug}", [$this, 'saveLongDescription']);
    }

    public function editLongDescriptionField($term)
    {
        $long_description = get_term_meta($term->term_id, 'long_description', true);
        ?>
        <tr class="form-field term-long-description-wrap">
            <th scope="row"><label for="long_description"><?php _e('Description longue', 'your-textdomain'); ?></label></th>
            <td>
                <?php
                wp_editor($long_description, 'long_description', [
                    'textarea_name' => 'long_description',
                    'textarea_rows' => 30,
                    'media_buttons' => false,
                ]);
                ?>
                <p class="description"><?php _e('Ajoutez une description longue pour cette catégorie.', 'your-textdomain'); ?></p>
            </td>
        </tr>
        <?php
    }

    public function saveLongDescription($term_id)
    {
        if (isset($_POST['long_description'])) {
            update_term_meta($term_id, 'long_description', wp_kses_post($_POST['long_description']));
        }
    }

    public function getLongDescription($term_id)
    {
        return get_term_meta($term_id, 'long_description', true);
    }
}
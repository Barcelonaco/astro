<?php

namespace App\FieldGroup;

use Bandco\Core\WordplateInit;
use Extended\ACF\Location;
use Extended\ACF\Fields\DatePicker;
use Extended\ACF\Fields\Email;
use Extended\ACF\Fields\FlexibleContent;
use Extended\ACF\Fields\GoogleMap;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;
use Extended\ACF\Fields\TimePicker;
use Extended\ACF\Fields\TrueFalse;
use Extended\ACF\Fields\URL;
use Extended\ACF\Fields\WYSIWYGEditor;
use App\Posttype\CptEvents;

class EventSingle extends WordplateInit
{

        public function fieldGroup(): array
        {
                $cptSlug = new CptEvents();
                return [
                        'key' => 'group_event',
                        'title' => "L'évènement",
                        'fields' => [
                                TrueFalse::make('Mettre en avant l\'évènement', 'is_sticky')
                                        ->stylized(on : 'Oui', off : 'Non')
                                        ->default(false)
                                        ->wrapper(['width' => 50]),
                                TrueFalse::make('Complet', 'sold_out')
                                        ->stylized(on : 'Oui', off : 'Non')
                                        ->default(false)
                                        ->wrapper(['width' => 50]),
                                Link::make('Lien personnalisé', 'cta'),
                                Textarea::make('Description courte (uniquement pour la vue liste)', 'desc')
                                        ->rows(3),
                                WYSIWYGEditor::make('Description longue', 'text')
                                        ->disableMediaUpload(),
                                DatePicker::make('Date de début', 'start_date')
                                        ->format('Y/m/d')
                                        ->helperText('<sub>(Ou date de l\'évènement)</sub>')
                                        ->required()
                                        ->wrapper(['width' => 50]),
                                DatePicker::make('Date de fin', 'end_date')
                                        ->helperText('<sub>&nbsp;</sub>')
                                        ->format('Y/m/d')
                                        ->wrapper(['width' => 50]),
                                TimePicker::make('Heure de début', 'start_time')
                                        ->format('H:i')
                                        ->helperText('<sub>(À partir de)</sub>')
                                        ->wrapper(['width' => 50]),
                                TimePicker::make('Heure de fin', 'end_time')
                                        ->format('H:i')
                                        ->helperText('<sub>&nbsp;</sub>')
                                        ->wrapper(['width' => 50]),
                                Text::make('Nom de l\'organisateur', 'contact_name')
                                        ->wrapper(['width' => 50]),
                                Text::make('Téléphone de l\'organisateur', 'contact_phone')
                                        ->maxLength(10)
                                        ->wrapper(['width' => 50]),
                                Email::make('Mail de l\'organisateur', 'contact_email')
                                        ->wrapper(['width' => 50]),
                                URL::make('Site web', 'website')
                                        ->wrapper(['width' => 50]),
                                Text::make('Entrée', 'price')
                                        ->helperText('ex : Gratuit, 5€ - 15€')
                                        ->wrapper(['width' => 50]),

                                Text::make('Nom du lieu ou du batiment', 'location_name')
                                        ->wrapper(['width' => 50]),
                                GoogleMap::make('Lieu', 'location'),
                        ],
                        'location' => [
                                Location::where('post_type', $cptSlug->getSlug()),
                        ],
                ];
        }
}

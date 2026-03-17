@php
    use App\Helpers\ThemeHelper;

    $socialNetwork = [
            'facebook' => get_field('facebook', 'options'),
            'linkedin' => get_field('linkedin', 'options'),
            'instagram' => get_field('instagram', 'options'),
            'youtube' => get_field('youtube', 'options'),
            'twitter' => get_field('twitter', 'options'),
            ];
@endphp

<main id="main" class="main-page page-waiting" role="main">
    <section>
        @if ($imgBanner)
            <div class="background">
            <img src="{{ $imgBanner['url'] }}" alt="{{ $imgBanner['alt'] }}" class="illus">
            </div>
        @endif

        <div class="desc">
            <div class="container">
                <p class="title">{{ !empty(get_field('text_maintenance', 'options')) ? get_field('text_maintenance', 'options') : bcn_pll('Site en développement') }}</p>
                <div class="logo-wrapper">
                    <img src="{{  ThemeHelper::getLogoWhite() }}" alt="{{ get_bloginfo('name', 'display') }}"
                         title="{{ get_bloginfo('name', 'display') }}" class="logo">
                </div>

                @if (get_field('show_infos', 'options'))
                    @if ($address = get_field('address', 'options'))
                        @php
                        $addressStreet = ($address['street_number'] ?? '') . ' ' .($address['street_name'] ?? '');
                        $addressStreetShort = ($address['street_number'] ?? '') . ' ' . ($address['street_name_short'] ?? '');
                        @endphp
                        <address class="address">
                        @if (($address['name'] != $addressStreet) && ($address['name'] != $addressStreetShort))
                            {{ $address['name']}}<br>
                        @endif
                        @if (!empty($address['street_name']))
                            {{ ($address['street_number'] ?? '') . ' ' .($address['street_name'] ?? '') }}<br>
                        @endif
                        {{ ($address['post_code'] ?? '') . ' ' .($address['city'] ?? '') }}
                        </address>
                    @endif
                    @if ($email = get_field('email', 'options'))
                        <p class="email-wrapper">
                            <a href="mailto:{{ $email }}" class="email">{{ $email }}</a>
                        </p>
                    @endif

                    @if ($phone = get_field('phone', 'options'))
                        <p class="phone-wrapper">
                            {{ bcn_pll('Tel.') }}
                            <a href="tel:{{ str_replace(' ', '', $phone) }}" class="phone">{{ $phone }}</a>
                        </p>
                    @endif

                    @if ($schedule = get_field('schedule', 'options'))
                        <div class="txt editor">
                            <p>{{ bcn_pll('Horaires d\'ouverture') }}</p>
                            <p>{{($schedule) }}</p>
                        </div>{{-- /.txt-2 --}}
                    @endif
                @endif

                @if (get_field('show_rs', 'options'))
                    @include('components.social-networks', ['address' => $socialNetwork])
                @endif

            </div>{{-- /.container --}}
        </div>{{-- /.desc --}}
    </section>
</main>{{-- /.page-maintenance --}}
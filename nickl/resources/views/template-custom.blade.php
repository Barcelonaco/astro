{{--
  Template Name: Custom Template
--}}

@extends('layouts.app')

@section('content')
  @include('partials.page-header')
  @while(have_posts()) @php(the_post())    
    @include('partials.content-page')
  @endwhile
@endsection
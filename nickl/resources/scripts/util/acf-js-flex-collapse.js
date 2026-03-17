acf.add_action('ready append', function($el){
  jQuery($el).find('.acf-flexible-content .layout').each(function(){
    var $layout = $(this);

    // collapse par défaut
    if (!$layout.hasClass('-collapsed')) {
      $layout.addClass('-collapsed').removeClass('-open');
      $layout.children('.acf-fields').hide();
    }
  });
});

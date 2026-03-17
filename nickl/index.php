<?php

// Affiche la vue avec les données
echo view(app('sage.view'), app('sage.data'))->render();
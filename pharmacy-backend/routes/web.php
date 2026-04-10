<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes (التطبيق يعتمد على API + React)
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return view('welcome');
});

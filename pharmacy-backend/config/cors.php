<?php

/*
|--------------------------------------------------------------------------
| allowed_origins
|--------------------------------------------------------------------------
| الافتراضي * يكفي غالباً. إن ظهرت أخطاء CORS من Vercel عيّن CORS_ALLOWED_ORIGINS على Render، مثال:
| https://pharmacy-frontend-psi.vercel.app — عدة أصول مفصولة بفاصلة.
*/
$corsOriginsEnv = env('CORS_ALLOWED_ORIGINS');
$allowedOrigins = ($corsOriginsEnv === null || $corsOriginsEnv === '')
    ? ['*']
    : array_values(array_filter(array_map('trim', explode(',', $corsOriginsEnv))));
// قيمة فارغة أو فواصل فقط = مصفوفة فارغة → لا يُرسل Access-Control-Allow-Origin → خطأ CORS في المتصفح
if ($allowedOrigins === []) {
    $allowedOrigins = ['*'];
}

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $allowedOrigins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];

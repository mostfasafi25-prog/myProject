<?php

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

/*
|--------------------------------------------------------------------------
| CORS preflight (OPTIONS) قبل تحميل Laravel
|--------------------------------------------------------------------------
| يضمن وجود Access-Control-Allow-Origin لطلبات المتصفح من Vercel وغيره
| حتى لو لم تُطبَّق middleware لأي سبب.
*/
$__rqMethod = $_SERVER['REQUEST_METHOD'] ?? '';
$__rqPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$__origin = null;
if (
    $__rqMethod === 'OPTIONS'
    && ($__rqPath === '/api' || str_starts_with($__rqPath, '/api/'))
) {
    $__origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    // إرجاع نفس Origin لـ Vercel أحياناً أنسب من * مع بعض البروكسيات/المتصفحات
    if (is_string($__origin) && $__origin !== '' && preg_match('#^https://[a-zA-Z0-9.-]+\.vercel\.app$#', $__origin)) {
        header('Access-Control-Allow-Origin: '.$__origin);
        header('Vary: Origin');
    } else {
        header('Access-Control-Allow-Origin: *');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, X-CSRF-TOKEN');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}
unset($__rqMethod, $__rqPath);

/*
|--------------------------------------------------------------------------
| Check If The Application Is Under Maintenance
|--------------------------------------------------------------------------
|
| If the application is in maintenance / demo mode via the "down" command
| we will load this file so that any pre-rendered content can be shown
| instead of starting the framework, which could cause an exception.
|
*/

if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

/*
|--------------------------------------------------------------------------
| Register The Auto Loader
|--------------------------------------------------------------------------
|
| Composer provides a convenient, automatically generated class loader for
| this application. We just need to utilize it! We'll simply require it
| into the script here so we don't need to manually load our classes.
|
*/

require __DIR__.'/../vendor/autoload.php';

/*
|--------------------------------------------------------------------------
| Run The Application
|--------------------------------------------------------------------------
|
| Once we have the application, we can handle the incoming request using
| the application's HTTP kernel. Then, we will send the response back
| to this client's browser, allowing them to enjoy our application.
|
*/

$app = require_once __DIR__.'/../bootstrap/app.php';

$kernel = $app->make(Kernel::class);

$request = Request::capture();
$response = $kernel->handle($request);

$__p = $request->path();
if ($__p === 'api' || str_starts_with($__p, 'api/')) {
    /*
    | إجبار رؤوس CORS على الرد النهائي — Fruitcake/HandleCors أحياناً لا يضيفها على POST
    | (فيُرفض الرد في المتصفح ويظهر Network Error في axios رغم أن السيرفر أجاب).
    */
    $__originHdr = (string) $request->headers->get('Origin');
    if ($__originHdr !== '' && preg_match('#^https://[a-zA-Z0-9.-]+\.vercel\.app$#', $__originHdr)) {
        $response->headers->set('Access-Control-Allow-Origin', $__originHdr);
    } elseif ($__originHdr !== '' && preg_match('#^http://localhost(:\d+)?$#', $__originHdr)) {
        $response->headers->set('Access-Control-Allow-Origin', $__originHdr);
    } else {
        $response->headers->set('Access-Control-Allow-Origin', '*');
    }
    $__varyParts = array_filter(array_map('trim', explode(',', (string) $response->headers->get('Vary', ''))));
    $__varyParts[] = 'Origin';
    $response->headers->set('Vary', implode(', ', array_unique($__varyParts)));
    unset($__varyParts, $__originHdr);
    if (! $response->headers->has('Access-Control-Allow-Methods')) {
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
    if (! $response->headers->has('Access-Control-Allow-Headers')) {
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, X-CSRF-TOKEN');
    }
}
unset($__p);

$response->send();

$kernel->terminate($request, $response);

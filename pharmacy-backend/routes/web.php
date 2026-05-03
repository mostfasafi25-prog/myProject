<?php

use App\Http\Controllers\BackendDashboardController;
use App\Http\Controllers\BackendNotificationDispatchController;
use App\Http\Controllers\BackendPharmacyController;
use App\Http\Controllers\BackendPharmacyPlanController;
use App\Http\Controllers\BackendPlanDefinitionsController;
use App\Http\Controllers\BackendPlansReferenceController;
use App\Http\Controllers\BackendScopeController;
use App\Http\Controllers\BackendTenantOnboardingController;
use App\Http\Controllers\BackendUserManagerController;
use App\Http\Controllers\BackendWebLoginController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (session('backend_web_ok') === true && (string) config('backend.web_password', '') !== '') {
        return redirect()->route('backend.dashboard');
    }

    return redirect()->route('backend.login');
});

Route::middleware(['backend.share_scope'])->group(function () {
    Route::get('/backend/login', [BackendWebLoginController::class, 'showLoginForm'])->name('backend.login');
});
Route::post('/backend/login', [BackendWebLoginController::class, 'login']);
Route::post('/backend/logout', [BackendWebLoginController::class, 'logout'])->name('backend.logout');

Route::middleware(['backend.web', 'backend.share_scope'])->prefix('backend')->name('backend.')->group(function () {
    Route::post('/scope/clear', [BackendScopeController::class, 'clear'])->name('scope.clear');
    Route::get('/', [BackendDashboardController::class, 'index'])->name('dashboard');
    Route::get('/plans', BackendPlansReferenceController::class)->name('plans.reference');
    Route::get('/plans/edit', [BackendPlanDefinitionsController::class, 'edit'])->name('plans.edit');
    Route::get('/plans/monthly/edit', function () {
        return redirect()->route('backend.plans.single.edit', 'monthly');
    });
    Route::get('/plans/{plan}/edit', [BackendPlanDefinitionsController::class, 'editSingle'])
        ->whereIn('plan', ['free', 'monthly', 'lifetime'])
        ->name('plans.single.edit');
    Route::put('/plans/definitions', [BackendPlanDefinitionsController::class, 'update'])->name('plans.definitions.update');
    Route::get('/new-tenant', [BackendTenantOnboardingController::class, 'create'])->name('tenants.create');
    Route::post('/new-tenant', [BackendTenantOnboardingController::class, 'store'])->name('tenants.store');
    Route::get('/pharmacies/{pharmacy}', [BackendDashboardController::class, 'pharmacyShow'])->name('pharmacies.show');
    Route::put('/pharmacies/{pharmacy}', [BackendPharmacyController::class, 'update'])->name('pharmacies.update');
    Route::delete('/pharmacies/{pharmacy}', [BackendPharmacyController::class, 'destroy'])->name('pharmacies.destroy');
    Route::get('/pharmacies/{pharmacy}/plan', [BackendPharmacyPlanController::class, 'edit'])->name('pharmacies.plan.edit');
    Route::put('/pharmacies/{pharmacy}/plan', [BackendPharmacyPlanController::class, 'update'])->name('pharmacies.plan.update');
    Route::post('/pharmacies/{pharmacy}/plan/monthly-payment', [BackendPharmacyPlanController::class, 'recordMonthlyPayment'])
        ->name('pharmacies.plan.monthly_payment');
    Route::resource('users', BackendUserManagerController::class)->except(['show']);
    Route::get('/notifications/send', [BackendNotificationDispatchController::class, 'create'])->name('notifications.send');
    Route::post('/notifications/send', [BackendNotificationDispatchController::class, 'store'])->name('notifications.send.store');
});

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Pharmacy extends Model
{
    protected $fillable = [
        'name',
        'currency_code',
        'currency_label',
        'monthly_subscription_amount',
        'subscription_plan',
        'subscription_status',
        'subscription_expires_at',
        'subscription_notes',
        'max_products_override',
        'max_users_override',
        'free_trial_ends_at',
    ];

    protected $casts = [
        'subscription_expires_at' => 'datetime',
        'free_trial_ends_at' => 'datetime',
        'monthly_subscription_amount' => 'decimal:2',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function monthlyPaymentLogs(): HasMany
    {
        return $this->hasMany(PharmacyMonthlyPaymentLog::class);
    }
}

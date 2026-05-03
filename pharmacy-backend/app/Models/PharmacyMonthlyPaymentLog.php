<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacyMonthlyPaymentLog extends Model
{
    protected $fillable = [
        'pharmacy_id',
        'recorded_at',
        'previous_expires_at',
        'previous_status',
        'new_expires_at',
    ];

    protected $casts = [
        'recorded_at' => 'datetime',
        'previous_expires_at' => 'datetime',
        'new_expires_at' => 'datetime',
    ];

    public function pharmacy(): BelongsTo
    {
        return $this->belongsTo(Pharmacy::class);
    }
}

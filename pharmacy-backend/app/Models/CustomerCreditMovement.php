<?php

namespace App\Models;

use App\Models\Concerns\BelongsToPharmacy;
use Illuminate\Database\Eloquent\Model;

class CustomerCreditMovement extends Model
{
    use BelongsToPharmacy;

    protected $fillable = [
        'pharmacy_id',
        'customer_id',
        'customer_name',
        'movement_type',
        'delta_amount',
        'reference_order_id',
        'payment_method',
        'cashier_id',
        'cashier_name',
        'note',
        'occurred_at',
    ];

    protected $casts = [
        'delta_amount' => 'decimal:2',
        'occurred_at' => 'datetime',
    ];
}


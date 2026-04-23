<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerCreditMovement extends Model
{
    protected $fillable = [
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


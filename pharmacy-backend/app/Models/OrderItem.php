<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    use HasFactory;
protected $guarded = [];

  

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'total_price' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
           'unit_cost' => 'decimal:2', // ⭐ جديد
        'unit_profit' => 'decimal:2', // ⭐ جديد
        'item_profit' => 'decimal:2', // ⭐ جديد
    ];

    /**
     * علاقة العنصر مع الطلب
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * علاقة العنصر مع المنتج
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
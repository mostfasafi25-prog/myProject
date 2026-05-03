<?php

namespace App\Models;

use App\Models\Concerns\BelongsToPharmacy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    use BelongsToPharmacy;
    use HasFactory;
protected $guarded = [];

  

    protected $casts = [
        'quantity' => 'decimal:2',
        'inventory_pieces_sold' => 'decimal:4',
        'sale_quantity_returned' => 'decimal:4',
        'unit_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'total_price' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
           'unit_cost' => 'decimal:2', // ⭐ جديد
        'unit_profit' => 'decimal:2', // ⭐ جديد
        'item_profit' => 'decimal:2', // ⭐ جديد
        'fifo_cost_layers' => 'array',
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
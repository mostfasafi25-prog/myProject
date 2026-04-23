<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_id',
        'product_id',
        'product_name',
        'quantity',
        'returned_quantity',
        'unit_price',
        'total_price',
        'discount',
        'tax',
        'subtotal'
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'returned_quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'subtotal' => 'decimal:2'
    ];

    /**
     * علاقة العنصر مع الشراء
     */
    public function purchase()
    {
        return $this->belongsTo(Purchase::class);
    }

    /**
     * علاقة العنصر مع المنتج
     */
    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
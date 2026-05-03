<?php

namespace App\Models;

use App\Models\Concerns\BelongsToPharmacy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseItem extends Model
{
    use BelongsToPharmacy;
    use HasFactory;

    protected $fillable = [
        'pharmacy_id',
        'purchase_id',
        'product_id',
        'product_name',
        'quantity',
        'returned_quantity',
        'remaining_quantity',
        'unit_price',
        'total_price',
        'discount',
        'tax',        'sale_price',        // ✅ أضف هذا

        'subtotal'
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'returned_quantity' => 'decimal:4',
        'remaining_quantity' => 'decimal:4',
        'unit_price' => 'decimal:4',
        'total_price' => 'decimal:4',
        'discount' => 'decimal:2',
        'sale_price' => 'decimal:2',    // ✅ أضف هذا

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
<?php

namespace App\Models;

use App\Models\Concerns\BelongsToPharmacy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseReturn extends Model
{
    use BelongsToPharmacy;
    use HasFactory;

    protected $fillable = [
        'pharmacy_id',
        'purchase_id',
        'supplier_id',
        'return_date',
        'total_amount',
        'items',
        'reason',
        'is_full_return',
        'created_by'
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'items' => 'array',
        'return_date' => 'date',
        'is_full_return' => 'boolean'
    ];

    public function purchase()
    {
        return $this->belongsTo(Purchase::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToPharmacy;
use App\Models\User;

class Order extends Model
{
    use BelongsToPharmacy;
    use HasFactory;
protected $guarded = [];

  

    protected $casts = [
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'refunded_amount' => 'decimal:2',
        'due_amount' => 'decimal:2',
        'total_profit' => 'decimal:2',  // ✅ أضف هذا السطر
        'total_cost' => 'decimal:2',  // ✅ أضف هذا السطر
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];

    /**
     * علاقة الطلب مع العميل
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }



    /**
     * علاقة الطلب مع العناصر (الصحيحة)
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * علاقة الطلب مع الموظف المسؤول
     */


    /**
 * علاقة الطلب مع الموظف المسؤول
 */
public function createdBy(): BelongsTo
{
    return $this->belongsTo(User::class, 'created_by');
}

    /**
     * علاقة الطلب مع معاملات الخزنة
     */
    public function treasuryTransactions(): HasMany
    {
        return $this->hasMany(TreasuryTransaction::class);
    }

    /**
     * نطاق الطلبات المكتملة
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'paid');
    }

    /**
     * نطاق الطلبات المعلقة
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * نطاق الطلبات المدفوعة
     */
    public function scopePaid($query)
    {
        return $query->where('status', 'paid');
    }

    /**
     * تحديث المال العام عند اكتمال الطلب مع ربط polymorphic
     */
    public function updateTreasury()
    {
        if ($this->status === 'paid' && $this->paid_amount > 0) {
            $treasury = Treasury::getActive();
            $treasury->addIncome(
                amount: $this->paid_amount,
                description: "بيع طلب #{$this->order_number}",
                category: 'sales',
                orderId: $this->id,
                referenceModel: $this
            );
        }
    }

    /**
     * توليد رقم طلب تلقائي
     */
    public static function generateOrderNumber(): string
    {
        $lastOrder = self::latest()->first();
        $number = $lastOrder ? $lastOrder->id + 1 : 1;
        return 'ORD-' . date('Ymd') . '-' . str_pad($number, 4, '0', STR_PAD_LEFT);
    }

    /**
     * حساب الإجماليات من العناصر
     */
   
    
    
    
    public function getTotalCostAttribute(): float
    {
        if (isset($this->attributes['total_cost']) && $this->attributes['total_cost'] !== null) {
            return (float) $this->attributes['total_cost'];
        }
        
        $cost = 0;
        foreach ($this->items as $item) {
            $cost += $item->unit_cost * $item->quantity;
        }
        return $cost;
    }
    
    /**
     * حساب الربح الإجمالي للطلب
     */
    public function getTotalProfitAttribute(): float
    {
        if (isset($this->attributes['total_profit']) && $this->attributes['total_profit'] !== null) {
            return (float) $this->attributes['total_profit'];
        }
        
        return $this->total - $this->total_cost;
    }
    
    // في دالة booted() أضف:
    protected static function booted()
    {
        static::saving(function ($order) {
            if ($order->items->isNotEmpty()) {
                $order->total_cost = $order->items->sum(function($item) {
                    return $item->unit_cost * $item->quantity;
                });
                $order->total_profit = $order->total - $order->total_cost;
            }
        });
    }
    
    public function calculateTotals(): void
    {
        $subtotal = $this->items->sum('total_price');
        $discount = $this->items->sum('discount');
        
        $this->subtotal = $subtotal - $discount;
        $this->tax = $this->subtotal * 0.15;
        $this->total = $this->subtotal + $this->tax;
        $this->due_amount = $this->total - $this->paid_amount;
        $this->total_cost = $this->items->sum(function($item) {
            return $item->unit_cost * $item->quantity;
        });
        $this->total_profit = $this->total - $this->total_cost; // ✅ أضف هذا
    }

}
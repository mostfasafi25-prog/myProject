<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

class Order extends Model
{
    use HasFactory;
protected $guarded = [];

  

    protected $casts = [
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'due_amount' => 'decimal:2',
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
    public function calculateTotals(): void
    {
        $subtotal = $this->items->sum('total_price');
        $discount = $this->items->sum('discount');
        
        $this->subtotal = $subtotal - $discount;
        $this->tax = $this->subtotal * 0.15;
        $this->total = $this->subtotal + $this->tax;
        $this->due_amount = $this->total - $this->paid_amount;
    }

}
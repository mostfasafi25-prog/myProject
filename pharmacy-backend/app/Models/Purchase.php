<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Purchase extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'invoice_number',
        'purchase_date',
        'due_date',
        'total_amount',
        'discount',
        'tax',
        'grand_total',
        'paid_amount',    

        'due_amount',
        'remaining_amount', 
    'category_id', // ⭐ أضف هذا

        'status',
        'payment_method',
        'notes',
        'created_by'
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'grand_total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'due_amount' => 'decimal:2',
        'purchase_date' => 'date',
        'due_date' => 'date'
    ];

    /**
     * علاقة الشراء مع القسم
     */
    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * علاقة الشراء مع العناصر
     */
    public function items()
    {
        return $this->hasMany(PurchaseItem::class);
    }

    /**
     * علاقة الشراء مع الموظف المسؤول
     */
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * علاقة الشراء مع معاملات الخزنة
     */
    public function treasuryTransactions()
    {
        return $this->hasMany(TreasuryTransaction::class);
    }

    /**
     * نطاق المشتريات المعلقة
     */
    public function scopePending($query)
    {
        return $query->whereIn('status', ['pending', 'partially_paid']);
    }

    /**
     * نطاق المشتريات المستحقة
     */
    public function scopeDue($query)
    {
        return $query->where('due_amount', '>', 0);
    }

    /**
     * نطاق المشتريات حسب القسم
     */
    public function scopeByCategory($query, $categoryId)
    {
        return $query->where('category_id', $categoryId);
    }

    /**
     * نطاق المشتريات المكتملة
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }
}
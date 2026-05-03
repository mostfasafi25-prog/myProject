<?php

namespace App\Models;

use App\Models\Concerns\BelongsToPharmacy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use BelongsToPharmacy;

    protected $table = 'customers';
    
    protected $fillable = [
        'pharmacy_id',
        'name',
        'salary',
        'department',
        'shift',
        'phone',         
        'role', 
        'total_purchases',
        'last_purchase_date'
    ];
    
    protected $attributes = [
        'role' => 'user', // قيمة افتراضية
        'total_purchases' => 0
    ];

    // علاقة الموظف مع الطلبات التي أنشأها
    public function createdOrders(): HasMany
    {
        return $this->hasMany(Order::class, 'created_by');
    }

    // ⭐⭐ العلاقة الجديدة مع معاملات الخزنة
    public function treasuryTransactions(): HasMany
    {
        return $this->hasMany(TreasuryTransaction::class, 'customer_id');
    }

    // عدد الطلبات التي أنشأها الموظف
    public function getOrdersCountAttribute()
    {
        return $this->createdOrders()->count();
    }

    // إجمالي مبيعات الموظف
    public function getTotalSalesAttribute()
    {
        return $this->createdOrders()->sum('total');
    }

    // متوسط قيمة الطلب للموظف
    public function getAverageOrderValueAttribute()
    {
        $count = $this->orders_count;
        return $count > 0 ? $this->total_sales / $count : 0;
    }

    // ⭐⭐ حساب الرصيد الحالي من معاملات الخزنة
    public function getCurrentBalanceAttribute()
    {
        $deposits = $this->treasuryTransactions()
            ->where('type', 'deposit')
            ->sum('amount');
            
        $withdrawals = $this->treasuryTransactions()
            ->where('type', 'withdraw')
            ->sum('amount');
            
        return $deposits - $withdrawals;
    }
}
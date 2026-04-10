<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PreparedMealStorage extends Model
{
    protected $fillable = [
        'saved_meal_id',
        'meal_name',
        'ingredients',
        
        // التكاليف
        'cost_per_unit',     // تكلفة الوحدة الواحدة
        'total_cost',        // التكلفة الإجمالية = cost_per_unit × quantity
        
        // الأسعار
        'original_price',    // السعر الأصلي من SavedMeal
        'current_price',     // السعر الحالي (قد يكون مختلفاً)
        'sale_price',        // سعر البيع الفعلي (عند البيع)
        
        // الكميات
        'quantity',          // الكمية المتاحة
        'initial_quantity',  // الكمية الأصلية عند التحضير
        
        // التواريخ
        'prepared_date',
        'expiry_date',
        
        // الحالة
        'status', // جاهزة، مباعة، منتهية، محجوزة، تالفة
        
        // معلومات إضافية
        'prepared_by',
        'batch_number',      // رقم الدفعة
        'storage_location',  // مكان التخزين
        'notes'
    ];

    protected $casts = [
        'ingredients' => 'array',
        'prepared_date' => 'datetime',
        'expiry_date' => 'datetime',
        'cost_per_unit' => 'decimal:2',
        'original_price' => 'decimal:2',
        'current_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'total_cost' => 'decimal:2'
    ];
    
    // علاقة مع SavedMeal
    public function savedMeal()
    {
        return $this->belongsTo(SavedMeal::class);
    }
    
    // ديناميك لحساب القيمة الإجمالية
    public function getTotalValueAttribute()
    {
        return $this->current_price * $this->quantity;
    }
    
    // ديناميك لحساب الربح المتوقع
    public function getExpectedProfitAttribute()
    {
        return ($this->current_price - $this->cost_per_unit) * $this->quantity;
    }
    
    // ديناميك للتحقق من الصلاحية
    public function getIsExpiredAttribute()
    {
        if (!$this->expiry_date) return false;
        return now()->greaterThan($this->expiry_date);
    }
}
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealIngredient extends Model
{
    protected $fillable = [
        'meal_id',
        'category_id',
        'quantity',
        'unit',
        'unit_cost',
        'total_cost',
        'notes',
        'sort_order'
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2'
    ];

    /**
     * العلاقة مع الوجبة
     */
    public function meal(): BelongsTo
    {
        return $this->belongsTo(Meal::class, 'meal_id');
    }

    /**
     * العلاقة مع القسم (المكون)
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    /**
     * التحقق أن المكون من قسم فرعي
     */
    public function scopeSubCategories($query)
    {
        return $query->whereHas('category', function($q) {
            $q->whereNotNull('parent_id');
        });
    }

    /**
     * حساب التكلفة الإجمالية تلقائياً
     */
    public function calculateTotalCost(): void
    {
        if ($this->quantity && $this->unit_cost) {
            $this->total_cost = $this->quantity * $this->unit_cost;
        }
    }
}
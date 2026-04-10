<?php
// app/Models/MealOption.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealOption extends Model
{
    protected $table = 'meal_options';

    protected $fillable = [
        'meal_id',
        'name',
        'price',
        'additional_cost',
        'group_name',
        'sort_order',
        'is_active'
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'additional_cost' => 'decimal:2',
        'is_active' => 'boolean',
        'sort_order' => 'integer'
    ];

    /**
     * العلاقة مع الوجبة
     */
    public function meal(): BelongsTo
    {
        return $this->belongsTo(Meal::class);
    }

    /**
     * 🔥 العلاقة مع مكونات الخيار (اختياري)
     */
    public function ingredients()
    {
        return $this->belongsToMany(Category::class, 'meal_option_ingredients', 'meal_option_id', 'category_id')
                    ->withPivot('quantity_needed')
                    ->withTimestamps();
    }

    /**
     * حساب التكلفة الإضافية للخيار
     */
    public function calculateAdditionalCost(): float
    {
        $total = $this->additional_cost;
        
        // إذا كان للخيار مكونات خاصة، أضف تكلفتها
        foreach ($this->ingredients as $ingredient) {
            if ($ingredient->pivot->quantity_needed > 0) {
                $unitCost = $ingredient->cost_price ?? $ingredient->sale_price ?? 0;
                $total += $unitCost * $ingredient->pivot->quantity_needed;
            }
        }
        
        return round($total, 2);
    }

    /**
     * الحصول على السعر النهائي (السعر الأساسي + التكلفة الإضافية)
     */
    public function getFinalPriceAttribute(): float
    {
        return round($this->price + $this->additional_cost, 2);
    }

    /**
     * نطاق للخيارات النشطة فقط
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * نطاق للخيارات حسب المجموعة
     */
    public function scopeByGroup($query, $groupName)
    {
        return $query->where('group_name', $groupName);
    }
}
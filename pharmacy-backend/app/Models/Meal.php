<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Meal extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'description',
        'category_id',
        'cost_price',
        'sale_price',
        'profit_margin',
        'fixed_price',
        'min_quantity',
        'max_quantity',
        'track_quantity',
        'image',
        'preparation_time',
        'is_available',
        'calories',
        'sort_order',
        'is_featured',
        'tags'
    ];

    protected $casts = [
        'tags' => 'array',
        'cost_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'profit_margin' => 'decimal:2',
        'calories' => 'decimal:2',
        'is_available' => 'boolean',
        'is_featured' => 'boolean',
        'track_quantity' => 'boolean',
        'fixed_price' => 'boolean',
    ];

    /**
     * العلاقة مع القسم الرئيسي
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    /**
     * العلاقة مع المكونات (الأقسام الفرعية)
     */
    public function ingredients(): HasMany
    {
        return $this->hasMany(MealIngredient::class, 'meal_id')
                    ->orderBy('sort_order')
                    ->orderBy('id');
    }

    /**
     * مكونات الوجبة من أصناف المشتريات (منتجات)
     */
    public function productIngredients(): HasMany
    {
        return $this->hasMany(MealProductIngredient::class, 'meal_id');
    }

    /**
     * العلاقة مع الأقسام الفرعية (من خلال المكونات)
     */
    public function subCategories()
    {
        return $this->belongsToMany(Category::class, 'meal_ingredients', 'meal_id', 'category_id')
                    ->withPivot('quantity', 'unit', 'notes', 'unit_cost', 'total_cost')
                    ->withTimestamps();
    }

    /**
     * 🔥 جديد: العلاقة مع خيارات الوجبة
     */
    public function options(): HasMany
    {
        return $this->hasMany(MealOption::class, 'meal_id')
                    ->where('is_active', true)
                    ->orderBy('sort_order')
                    ->orderBy('id');
    }

    /**
     * 🔥 جديد: العلاقة مع جميع خيارات الوجبة (حتى الغير نشطة)
     */
    public function allOptions(): HasMany
    {
        return $this->hasMany(MealOption::class, 'meal_id')
                    ->orderBy('sort_order')
                    ->orderBy('id');
    }

    /**
     * 🔥 جديد: الحصول على الخيارات مجمعة (للعرض في الواجهات)
     */
    public function getGroupedOptionsAttribute()
    {
        return $this->options->groupBy(function($option) {
            return $option->group_name ?? 'أخرى';
        });
    }

    /**
     * حساب تكلفة الوجبة من مكوناتها
     */
    public function calculateCostFromIngredients(): float
    {
        $totalCost = $this->ingredients->sum(function ($ingredient) {
            return $ingredient->total_cost ?? 0;
        });
        
        return round($totalCost, 2);
    }

    /**
     * تحديث تكلفة الوجبة بناءً على المكونات
     */
    public function updateCostFromIngredients(): bool
    {
        $calculatedCost = $this->calculateCostFromIngredients();
        
        if ($calculatedCost > 0) {
            $this->cost_price = $calculatedCost;
            
            // إذا كان هناك هامش ربح محدد، احسب سعر البيع
            if ($this->profit_margin && $this->profit_margin > 0) {
                $this->sale_price = $this->cost_price * (1 + ($this->profit_margin / 100));
            }
            
            return $this->save();
        }
        
        return false;
    }

    /**
     * إضافة مكون جديد للوجبة
     */
    public function addIngredient($categoryId, $quantity = 1, $unit = 'piece', $notes = null)
    {
        // التحقق أن القسم فرعي
        $category = Category::find($categoryId);
        if (!$category || $category->parent_id === null) {
            throw new \Exception('يجب اختيار قسم فرعي كمكون');
        }

        // الحصول على سعر القسم إذا كان متاحاً
        $unitCost = $category->cost_price ?? $category->sale_price ?? 0;

        return MealIngredient::create([
            'meal_id' => $this->id,
            'category_id' => $categoryId,
            'quantity' => $quantity,
            'unit' => $unit,
            'unit_cost' => $unitCost,
            'total_cost' => $quantity * $unitCost,
            'notes' => $notes
        ]);
    }

    /**
     * 🔥 جديد: إضافة خيار للوجبة
     */
    public function addOption($data)
    {
        return MealOption::create([
            'meal_id' => $this->id,
            'name' => $data['name'],
            'price' => $data['price'] ?? 0,
            'additional_cost' => $data['additional_cost'] ?? 0,
            'group_name' => $data['group_name'] ?? null,
            'sort_order' => $data['sort_order'] ?? $this->options()->count(),
            'is_active' => $data['is_active'] ?? true
        ]);
    }

    /**
     * 🔥 جديد: تحديث أسعار الخيارات
     */
    public function updateOptionPrice($optionId, $newPrice)
    {
        $option = $this->options()->find($optionId);
        if ($option) {
            $option->update(['price' => $newPrice]);
            return $option;
        }
        return null;
    }

    /**
     * 🔥 جديد: الحصول على أقل وأعلى سعر للخيارات
     */
    public function getPriceRangeAttribute()
    {
        $prices = $this->options->pluck('price')->filter();
        
        if ($prices->isEmpty()) {
            return [
                'min' => $this->sale_price,
                'max' => $this->sale_price
            ];
        }

        return [
            'min' => $prices->min(),
            'max' => $prices->max()
        ];
    }
}
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'type',
        'scope',
        'icon',
        'color',
        'parent_id',
        'sort_order',
        'is_active',
        'show_in_menu',
        'unit_type',
        'available_units',
        'meta_data',
        // حقول المخزون والتسعير
        'cost_price',
        'profit_margin',
        'sale_price',
        'quantity',
        'min_quantity',
        'max_quantity',
        'total_cost',
        'total_value',
        'track_quantity',
        'auto_calculate'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'show_in_menu' => 'boolean',
        'track_quantity' => 'boolean',
        'auto_calculate' => 'boolean',
        'sort_order' => 'integer',
        'quantity' => 'float',
        'min_quantity' => 'float',
        'max_quantity' => 'float',
        'cost_price' => 'decimal:2',
        'profit_margin' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'total_value' => 'decimal:2',
        'meta_data' => 'array',
        'available_units' => 'array',
        'color' => 'string',
    ];

    protected $attributes = [
        'icon' => 'category',
        'color' => '#6B7280',
        'type' => 'main',
        'scope' => 'purchase',
        'unit_type' => 'none',
        'show_in_menu' => true,
        'is_active' => true,
        'sort_order' => 0,
    ];

    /**
     * العلاقات
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parent_id');
    }

    /** اسم بديل لـ children للتوافق مع الواجهات */
    public function subCategories(): HasMany
    {
        return $this->children();
    }

    public function descendants()
    {
        return $this->children()->with('descendants');
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'category_product')
                    ->withTimestamps();
    }

    /**
     * Scopes
     */
    public function scopeSubCategories($query)
    {
        return $query->whereNotNull('parent_id');
    }

    public function scopeMainCategories($query)
    {
        return $query->whereNull('parent_id');
    }

    public function scopeShowInMenu($query)
    {
        return $query->where('show_in_menu', true);
    }

    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    /** أقسام المشتريات فقط (بهارات، لحوم مشتريات، خضار...) */
    public function scopePurchase($query)
    {
        return $query->where('scope', 'purchase');
    }

    /** أقسام المبيعات فقط (لحوم أطباق، عصائر، سلطات...) */
    public function scopeSales($query)
    {
        return $query->where('scope', 'sales');
    }

    public function scopeByUnitType($query, $unitType)
    {
        return $query->where('unit_type', $unitType);
    }

    public function scopeTracked($query)
    {
        return $query->where('track_quantity', true);
    }

    public function scopeLowQuantity($query)
    {
        return $query->where('track_quantity', true)
                    ->whereColumn('quantity', '<=', 'min_quantity');
    }

    public function scopeWithProducts($query)
    {
        return $query->whereHas('products');
    }

    public function scopeMainWithSubs($query)
    {
        return $query->whereNull('parent_id')
                     ->where('is_active', true)
                     ->with(['children' => function($q) {
                         $q->where('is_active', true)
                           ->orderBy('sort_order');
                     }]);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order');
    }

    /**
     * Accessors
     */
    public function getTypeNameAttribute(): string
    {
        return $this->type === 'main' ? 'قسم رئيسي' : 'قسم فرعي';
    }

    public function getUnitNameAttribute(): string
    {
        $units = [
            'kg' => 'كيلوغرام',
            'gram' => 'غرام',
            'quantity' => 'كمية',
            'liter' => 'لتر',
            'ml' => 'ملليلتر',
            'piece' => 'قطعة',
            'box' => 'صندوق',
            'none' => 'بدون وحدة'
        ];
        
        return $units[$this->unit_type] ?? $this->unit_type;
    }

    public function getIsWeightBasedAttribute(): bool
    {
        return in_array($this->unit_type, ['kg', 'gram']);
    }

    public function getIsQuantityBasedAttribute(): bool
    {
        return $this->unit_type === 'quantity';
    }

    public function getIsVolumeBasedAttribute(): bool
    {
        return in_array($this->unit_type, ['liter', 'ml']);
    }

    public function getRootParentAttribute()
    {
        $parent = $this->parent;
        while ($parent && $parent->parent) {
            $parent = $parent->parent;
        }
        return $parent;
    }

    public function getExpectedProfitAttribute()
    {
        if ($this->cost_price && $this->sale_price && $this->quantity) {
            return ($this->sale_price - $this->cost_price) * $this->quantity;
        }
        
        return 0;
    }

    public function getProfitPercentageAttribute()
    {
        if ($this->cost_price && $this->profit_margin) {
            return round(($this->profit_margin / $this->cost_price) * 100, 2);
        }
        
        return 0;
    }

    public function getRemainingValueAttribute()
    {
        return $this->sale_price * $this->quantity;
    }

    public function getHasChildrenAttribute(): bool
    {
        return $this->children()->exists();
    }

    public function getIsMainAttribute(): bool
    {
        return $this->type === 'main' || is_null($this->parent_id);
    }

    public function getIsSubAttribute(): bool
    {
        return $this->type === 'sub' || !is_null($this->parent_id);
    }

    public function getFullPathAttribute(): string
    {
        $path = [$this->name];
        $parent = $this->parent;
        
        while ($parent) {
            array_unshift($path, $parent->name);
            $parent = $parent->parent;
        }
        
        return implode(' > ', $path);
    }

    /**
     * Mutators
     */
    public function setNameAttribute($value)
    {
        $this->attributes['name'] = $value;
        
        // توليد slug تلقائي إذا لم يتم توفيره
        if (empty($this->attributes['slug'])) {
            $this->attributes['slug'] = str()->slug($value);
        }
    }

    /**
     * الدوال المساعدة
     */
    protected static function boot()
    {
        parent::boot();

        // قبل الحفظ، حساب سعر البيع إذا كان تلقائي
        static::saving(function ($category) {
            if ($category->auto_calculate && $category->cost_price && $category->profit_margin) {
                $category->sale_price = $category->cost_price + $category->profit_margin;
            }
            
            // حساب الإجماليات
            if ($category->cost_price && $category->quantity) {
                $category->total_cost = $category->cost_price * $category->quantity;
                $category->total_value = $category->sale_price * $category->quantity;
            }
        });

        // بعد إنشاء قسم فرعي، نسخ إعدادات القسم الرئيسي
        static::created(function ($category) {
            if ($category->parent_id && $category->parent) {
                $category->update([
                    'track_quantity' => $category->parent->track_quantity,
                    'auto_calculate' => $category->parent->auto_calculate,
                    'unit_type' => $category->parent->unit_type,
                ]);
            }
        });

        // قبل حذف قسم، التحقق من عدم وجود أقسام فرعية
        static::deleting(function ($category) {
            if ($category->children()->exists()) {
                throw new \Exception('لا يمكن حذف قسم رئيسي لديه أقسام فرعية');
            }
        });
    }

    public function increaseQuantity($amount = 1)
    {
        $this->quantity += $amount;
        $this->save();
        
        // تحديث الإجماليات
        $this->recalculateTotals();
        
        return $this;
    }

    public function decreaseQuantity($amount = 1)
    {
        $this->quantity = max(0, $this->quantity - $amount);
        $this->save();
        
        // تحديث الإجماليات
        $this->recalculateTotals();
        
        return $this;
    }

    public function recalculateTotals()
    {
        if ($this->cost_price) {
            $this->total_cost = $this->cost_price * $this->quantity;
        }
        
        if ($this->sale_price) {
            $this->total_value = $this->sale_price * $this->quantity;
        }
        
        $this->saveQuietly();
        
        return $this;
    }

    public function isLowQuantity(): bool
    {
        return $this->track_quantity && $this->quantity <= $this->min_quantity;
    }

    public function isOverMaxQuantity(): bool
    {
        return $this->track_quantity && $this->max_quantity && $this->quantity > $this->max_quantity;
    }

    public function isOutOfStock(): bool
    {
        return $this->track_quantity && $this->quantity <= 0;
    }

    public function validateUnitForProduct($unit): bool
    {
        // إذا كانت الوحدة المختارة غير موجودة في الوحدات المتاحة
        if ($this->available_units && !in_array($unit, $this->available_units)) {
            return false;
        }
        
        return true;
    }

    public function convertQuantity($quantity, $fromUnit, $toUnit)
    {
        $conversions = [
            'kg_to_gram' => 1000,
            'gram_to_kg' => 0.001,
            'liter_to_ml' => 1000,
            'ml_to_liter' => 0.001,
        ];
        
        $key = $fromUnit . '_to_' . $toUnit;
        
        if (isset($conversions[$key])) {
            return $quantity * $conversions[$key];
        }
        
        return $quantity; // نفس الوحدة أو لا يوجد تحويل
    }

    public function getAvailableUnitsList(): array
    {
        if ($this->available_units) {
            return $this->available_units;
        }
        
        // إذا لم تكن هناك وحدات محددة، نرجع الوحدة الأساسية كمصفوفة
        return $this->unit_type !== 'none' ? [$this->unit_type] : [];
    }

    public function updateProductCount(): void
    {
        $count = $this->products()->count();
        $this->meta_data = array_merge($this->meta_data ?? [], ['products_count' => $count]);
        $this->saveQuietly();
    }

    public function getProductCountAttribute(): int
    {
        return $this->meta_data['products_count'] ?? $this->products()->count();
    }

    /**
     * Scopes إضافية للتقارير
     */
    public function scopeNeedsReorder($query)
    {
        return $query->where('track_quantity', true)
                     ->whereColumn('quantity', '<=', 'min_quantity');
    }

    public function scopeWithStockValue($query)
    {
        return $query->select('*')
                     ->selectRaw('(sale_price * quantity) as stock_value');
    }

    public function scopeByProfitMargin($query, $minMargin = 0, $maxMargin = null)
    {
        $query->whereNotNull('profit_margin')
              ->where('profit_margin', '>=', $minMargin);
        
        if ($maxMargin) {
            $query->where('profit_margin', '<=', $maxMargin);
        }
        
        return $query;
    }
}
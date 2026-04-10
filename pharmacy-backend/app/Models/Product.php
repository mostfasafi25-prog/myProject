<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'price' => 'decimal:2',
        'purchase_price' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'stock' => 'decimal:3',
        'min_stock' => 'decimal:2',
        'max_stock' => 'decimal:2',
        'reorder_point' => 'decimal:2',
        'has_addons' => 'boolean',
        'is_active' => 'boolean'
    ];

    /**
     * علاقة المنتج مع الفئة الرئيسية (إذا كان لديك حقل category_id في جدول products)
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * علاقة المنتج مع الأقسام (متعددة) عبر الجدول الوسيط
     */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(
            Category::class,
            'category_product',   // اسم الجدول الوسيط
            'product_id',         // اسم العمود في الجدول الوسيط لهذا الموديل
            'category_id'         // اسم العمود في الجدول الوسيط للموديل المرتبط
        )->withTimestamps();
    }

    /**
     * علاقة المنتج مع المورد
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /**
     * علاقة المنتج مع تفاصيل المشتريات
     */
    public function purchaseItems(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    /**
     * علاقة المنتج مع عناصر الطلبات
     */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * نطاق للمنتجات النشطة فقط
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * نطاق للمنتجات منخفضة المخزون
     */
    public function scopeLowStock($query)
    {
        return $query->whereRaw('stock <= reorder_point');
    }

    /**
     * نطاق للبحث بالاسم أو الباركود أو SKU
     */
    public function scopeSearch($query, $term)
    {
        return $query->where('name', 'like', "%{$term}%")
                    ->orWhere('barcode', 'like', "%{$term}%")
                    ->orWhere('sku', 'like', "%{$term}%");
    }

    /**
     * التحقق من وصول المخزون للنقطة الحرجة
     */
    public function isLowStock(): bool
    {
        return $this->stock <= $this->reorder_point;
    }

    /**
     * التحقق من نفاذ المخزون
     */
    public function isOutOfStock(): bool
    {
        return $this->stock <= 0;
    }

    /**
     * زيادة المخزون
     */
    public function increaseStock(float $quantity): void
    {
        $this->stock += $quantity;
        $this->save();
    }

    /**
     * تقليل المخزون
     */
    public function decreaseStock(float $quantity): void
    {
        $this->stock = max(0, $this->stock - $quantity);
        $this->save();
    }

    /**
     * العلاقة مع الأقسام مع تحديد الأعمدة بوضوح لتجنب ambiguous column
     */
    public function categoriesWithDetails()
    {
        return $this->belongsToMany(
            Category::class,
            'category_product',
            'product_id',
            'category_id'
        )->select('categories.*'); // ⭐ تحديد الأعمدة
    }
}
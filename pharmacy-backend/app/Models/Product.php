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
    
    protected $fillable = [
        'name',
        'code',
        'description',
        'image_url',
        'price',
        'purchase_price',
        'cost_price',
        'profit_amount',
        'category_id',
        'supplier_id',
        'stock',
        'min_stock',
        'max_stock',
        'reorder_point',
        'unit',
        'allow_split_sales',
        'strip_unit_count',
        'split_item_name',
        'split_sale_options',
        'pieces_per_strip',
        'strips_per_box',
        'purchase_unit',
        'sale_unit',
        'sku',
        'barcode',
        'has_addons',
        'is_active',
        'split_sale_price',  // 👈 أضف هذا السطر
        'custom_child_price',
        'full_unit_name',
        'divide_into',
        'allow_small_pieces',
        'pieces_count',

    ];

    protected $casts = [
        'price' => 'decimal:2',
        'purchase_price' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'stock' => 'decimal:3',
        'min_stock' => 'decimal:2',
        'max_stock' => 'decimal:2',
        'reorder_point' => 'decimal:2',
        'has_addons' => 'boolean',
        'is_active' => 'boolean',
        'allow_split_sales' => 'boolean',
        'strip_unit_count' => 'decimal:3',
        'split_sale_options' => 'array',
        'pieces_per_strip' => 'decimal:3',
        'strips_per_box' => 'decimal:3',
        'split_sale_price' => 'decimal:2',  // 👈 أضف هذا السطر
        'custom_child_price' => 'decimal:2',
        'divide_into' => 'integer',
        'allow_small_pieces' => 'boolean',
        'pieces_count' => 'integer',

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
     * عدد القطع (الحبات) في وحدة البيع الافتراضية — يطابق منطق OrderController::convertSaleQuantityToPieces.
     * cost_price و purchase_price يُفترض أنهما بنفس وحدة البيع (علبة / شريط / حبة).
     */
   /**
 * عدد القطع (الحبات) في وحدة البيع الافتراضية
 * للمنتجات التي تسمح بالتجزئة، نستخدم pieces_count إذا كان متوفراً
 */
public function piecesPerSaleUnit(): float
{
    // ✅✅✅ التعديل: للمنتجات التي تسمح بالتجزئة
    if ($this->allow_split_sales) {
        // إذا كان هناك pieces_count محدد، استخدمه مباشرة
        if ($this->pieces_count && $this->pieces_count > 0) {
            return (float) $this->pieces_count;
        }
        
        // إذا كان هناك divide_into، فهذا يعني أن الوحدة الكاملة تتجزأ إلى أجزاء
        if ($this->divide_into && $this->divide_into > 0) {
            // نحتاج إلى معرفة عدد القطع في الوحدة الكاملة
            // إذا كان هناك pieces_per_strip و strips_per_box
            $piecesPerStrip = (float) ($this->pieces_per_strip ?: 1);
            $stripsPerBox = (float) ($this->strips_per_box ?: 1);
            if ($piecesPerStrip > 0 && $stripsPerBox > 0) {
                return $piecesPerStrip * $stripsPerBox;
            }
            // افتراضياً: عدد الأجزاء × 1
            return (float) $this->divide_into;
        }
    }
    
    // للمنتجات العادية (غير مجزأة)
    $unit = strtolower((string) ($this->sale_unit ?: $this->unit ?: 'piece'));
    $piecesPerStrip = (float) ($this->pieces_per_strip ?: $this->strip_unit_count ?: 1);
    $piecesPerStrip = $piecesPerStrip > 0 ? $piecesPerStrip : 1.0;
    $stripsPerBox = (float) ($this->strips_per_box ?: 1);
    $stripsPerBox = $stripsPerBox > 0 ? $stripsPerBox : 1.0;

    if ($unit === 'box') {
        return $stripsPerBox * $piecesPerStrip;
    }
    if ($unit === 'strip' || $unit === 'pack') {
        return $piecesPerStrip;
    }

    return 1.0;
}

    /**
     * قيمة المخزون عندما يكون stock بالحبات و cost_price بوحدة البيع (علبة مثلاً).
     */
    public function stockInventoryValue(): float
    {
        $stock = (float) $this->stock;
        $cost = (float) ($this->cost_price ?? $this->purchase_price ?? 0);
        if ($stock <= 0 || $cost <= 0) {
            return 0.0;
        }
        $perSale = $this->piecesPerSaleUnit();
        $perSale = $perSale > 0 ? $perSale : 1.0;

        return $stock * ($cost / $perSale);
    }

    /**
     * تكلفة الحبة الواحدة (المخزون بالحبات) من cost_price المعرَّفة بوحدة البيع.
     */
    public function costPricePerInventoryPiece(): float
    {
        $cost = (float) ($this->cost_price ?? $this->purchase_price ?? 0);
        if ($cost <= 0) {
            return 0.0;
        }
        $per = $this->piecesPerSaleUnit();
        $per = $per > 0 ? $per : 1.0;

        return $cost / $per;
    }

    /**
     * تحويل كمية البيع (علبة/شريط/حبة) إلى عدد الحبات في المخزون — يطابق OrderController السابق.
     */
    public function saleQuantityToInventoryPieces(float $quantity, ?string $saleUnit): float
    {
        $qty = max(0.0, (float) $quantity);
        $unit = strtolower((string) ($saleUnit ?: $this->sale_unit ?: $this->unit ?: 'piece'));
        if ($unit === 'piece') {
            $unit = 'pill';
        }
        $piecesPerStrip = (float) ($this->pieces_per_strip ?: $this->strip_unit_count ?: 1);
        $piecesPerStrip = $piecesPerStrip > 0 ? $piecesPerStrip : 1.0;
        $stripsPerBox = (float) ($this->strips_per_box ?: 1);
        $stripsPerBox = $stripsPerBox > 0 ? $stripsPerBox : 1.0;

        if ($unit === 'box') {
            return $qty * $stripsPerBox * $piecesPerStrip;
        }
        if ($unit === 'strip' || $unit === 'pack') {
            return $qty * $piecesPerStrip;
        }

        return $qty;
    }

    /**
     * تكلفة وحدة البيع للسطر (سعر الشراء المحفوظ يخص وحدة المنتج sale_unit، مثلاً العلبة).
     */
   /**
 * تكلفة وحدة البيع للسطر
 */
public function unitCostForSaleType(?string $lineSaleType): float
{
    $cost = (float) ($this->cost_price ?? $this->purchase_price ?? 0);
    if ($cost <= 0) {
        return 0.0;
    }

    // ✅✅✅ للمنتجات المجزأة، سعر التكلفة للوحدة الكاملة
    if ($this->allow_split_sales) {
        $totalPieces = $this->piecesPerSaleUnit();
        if ($totalPieces <= 0) {
            return round($cost, 4);
        }
        
        $lineUnit = strtolower((string) ($lineSaleType ?: 'box'));
        
        // حساب عدد القطع في وحدة البيع المطلوبة
        $piecesInLineUnit = 1;
        if ($lineUnit === 'box') {
            $piecesInLineUnit = $totalPieces;
        } elseif ($lineUnit === 'strip') {
            $piecesPerStrip = (float) ($this->pieces_per_strip ?: 1);
            $piecesInLineUnit = $piecesPerStrip > 0 ? $piecesPerStrip : 1;
        } elseif ($lineUnit === 'pill') {
            $piecesInLineUnit = 1;
        }
        
        // تكلفة الوحدة = (التكلفة الكلية / عدد القطع الكلي) × عدد القطع في الوحدة
        $costPerPiece = $cost / $totalPieces;
        return round($costPerPiece * $piecesInLineUnit, 4);
    }

    // للمنتجات العادية (نفس الكود القديم)
    $refUnit = strtolower((string) ($this->sale_unit ?: $this->unit ?: 'piece'));
    if ($refUnit === 'piece') {
        $refUnit = 'pill';
    }
    $lineUnit = strtolower((string) ($lineSaleType ?: $refUnit));
    if ($lineUnit === 'piece') {
        $lineUnit = 'pill';
    }

    $piecesRef = $this->saleQuantityToInventoryPieces(1.0, $refUnit);
    $piecesLine = $this->saleQuantityToInventoryPieces(1.0, $lineUnit);
    if ($piecesRef <= 0.0000001) {
        return round($cost, 4);
    }

    return round($cost * ($piecesLine / $piecesRef), 4);
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
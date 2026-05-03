<?php

namespace App\Models;

use App\Models\Concerns\BelongsToPharmacy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TreasuryTransaction extends Model
{
    use BelongsToPharmacy;
    use HasFactory;

    protected $table = 'treasury_transactions';

    protected $fillable = [
        'pharmacy_id',
        'treasury_id',
        'transaction_number',
        'type',
        'amount',
        'description',
        'category',
        'order_id',
        'employee_id',
        'purchase_id',
        'supplier_id',
        'product_id',
        'created_by',
        'status',
        'transaction_date',
        'payment_method',
        'reference_type',
        'reference_id',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'metadata' => 'array',
        'transaction_date' => 'date',
    ];

    protected $attributes = [
        'status' => 'completed',
        'payment_method' => 'cash',
    ];

    /**
     * Model Events - تعيين القيم الافتراضية تلقائياً
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->transaction_date)) {
                $model->transaction_date = now()->toDateString();
            }

            if (empty($model->transaction_number)) {
                $prefix = $model->type === 'income' ? 'INC' : 'EXP';
                $model->transaction_number = $prefix . '-' . time() . '-' . rand(1000, 9999);
            }

            if (empty($model->created_by) && auth()->check()) {
                $model->created_by = auth()->id();
            }

            if (empty($model->treasury_id)) {
                $model->treasury_id = Treasury::getActive()->id;
            }
        });
    }

    // ==================== Relations ====================

    public function treasury()
    {
        return $this->belongsTo(Treasury::class);
    }

    public function referenceable()
    {
        return $this->morphTo('reference', 'reference_type', 'reference_id');
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function purchase()
    {
        return $this->belongsTo(Purchase::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function creator()
    {
        return $this->belongsTo(Customer::class, 'created_by');
    }

    public function employee()
    {
        return $this->belongsTo(Customer::class, 'employee_id');
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    // ==================== Accessors ====================

    public function getCategoryNameAttribute()
    {
        $categories = [
            'sales' => 'مبيعات',
            'purchases' => 'مشتريات',
            'salaries' => 'رواتب',
            'rent' => 'إيجار',
            'utilities' => 'خدمات',
            'maintenance' => 'صيانة',
            'other' => 'أخرى',
        ];

        return $categories[$this->category] ?? $this->category;
    }

    public function getTypeNameAttribute()
    {
        $types = [
            'income' => 'دخل',
            'expense' => 'مصروف',
            'deposit' => 'ودائع',
            'withdraw' => 'سحب',
            'manual_adjustment' => 'تعديل يدوي',
        ];

        return $types[$this->type] ?? $this->type;
    }

    public function getPaymentMethodNameAttribute()
    {
        $methods = [
            'cash' => 'نقدي',
            'app' => 'تطبيق',
            'bank_transfer' => 'تحويل بنكي',
            'check' => 'شيك',
            'card' => 'بطاقة',
            'mixed' => 'مختلط',
        ];

        return $methods[$this->payment_method] ?? $this->payment_method;
    }

    // ==================== Scopes ====================

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    public function scopeOfCategory($query, $category)
    {
        return $query->where('category', $category);
    }

    public function scopeOnDate($query, $date)
    {
        return $query->whereDate('transaction_date', $date);
    }

    public function scopeBetweenDates($query, $startDate, $endDate)
    {
        return $query->whereBetween('transaction_date', [$startDate, $endDate]);
    }

    public function scopeIncome($query)
    {
        return $query->where('type', 'income');
    }

    public function scopeExpense($query)
    {
        return $query->where('type', 'expense');
    }
}

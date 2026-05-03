<?php

namespace App\Models;

use App\Models\Concerns\BelongsToPharmacy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class Treasury extends Model
{
    use BelongsToPharmacy;
    use HasFactory;
    
    protected $table = 'treasury';

    protected $fillable = [
        'pharmacy_id',
        'balance',
        'balance_cash',
        'balance_app',
        'total_income',
        'total_expenses',
         'total_profit',
    'total_sales',
    'total_sold_items'
    ];

    protected $casts = [
        'balance' => 'decimal:2',
        'balance_cash' => 'decimal:2',
        'balance_app' => 'decimal:2',
        'total_income' => 'decimal:2',
        'total_expenses' => 'decimal:2'
    ];

    /**
     * تعديل سيولة الكاش والتطبيق معاً؛ balance = balance_cash + balance_app
     */
    public function applyLiquidityDelta(float $deltaCash, float $deltaApp): void
    {
        $this->balance_cash = round((float) ($this->balance_cash ?? 0) + $deltaCash, 2);
        $this->balance_app = round((float) ($this->balance_app ?? 0) + $deltaApp, 2);
        $this->balance = round((float) $this->balance_cash + (float) $this->balance_app, 2);
    }

    /** عمليات قديمة تُفترض نقدية (رواتب، سحب يدوي افتراضي، إلخ) */
    public function adjustCashLegacy(float $delta): void
    {
        $this->applyLiquidityDelta($delta, 0);
    }

    /**
     * الحصول على السجل الفعال (أو إنشاء واحد جديد)
     */
    public static function getActive(): self
    {
        $pharmacyId = Auth::user()?->pharmacy_id;
        if ($pharmacyId === null) {
            $pharmacyId = (int) config('pharmacy.default_pharmacy_id', 1);
        }

        return self::withoutGlobalScopes()->firstOrCreate(
            ['pharmacy_id' => $pharmacyId],
            [
                'balance' => 0,
                'balance_cash' => 0,
                'balance_app' => 0,
                'total_income' => 0,
                'total_expenses' => 0,
                'total_profit' => 0,
                'total_sales' => 0,
                'total_sold_items' => 0,
            ]
        );
    }

    public static function lockActiveForUpdate(): ?self
    {
        $active = self::getActive();

        return self::withoutGlobalScopes()->whereKey($active->id)->lockForUpdate()->first();
    }

    /**
     * إضافة مبلغ إلى المال العام (دخل)
     * 
     * @param float $amount المبلغ
     * @param string $description وصف المعاملة
     * @param string $category فئة المعاملة
     * @param int|null $orderId معرف الطلب (إن وجد)
     * @param int|null $purchaseId معرف الشراء (إن وجد)
     * @param string|null $transactionDate تاريخ المعاملة
     * @param object|null $referenceModel نموذج مرجعي (Order, Purchase, Meal, Category)
     * @return $this
     */
    public function addIncome($amount, $description, $category = 'other', $orderId = null, $purchaseId = null, $transactionDate = null, $referenceModel = null)
    {
        $this->balance += $amount;
        $this->total_income += $amount;
        $this->save();

        $transactionData = [
            'transaction_number' => 'INC-' . time() . '-' . rand(1000, 9999),
            'type' => 'income',
            'amount' => $amount,
            'description' => $description,
            'category' => $category,
            'order_id' => $orderId,
            'purchase_id' => $purchaseId,
            'created_by' => Auth::check() ? Auth::id() : 1,
            'transaction_date' => $transactionDate ?? now()->format('Y-m-d'),
            'status' => 'completed',
            'payment_method' => 'cash'
        ];
        
        // ربط polymorphic إذا تم تمرير نموذج مرجعي
        if ($referenceModel) {
            $transactionData['reference_type'] = get_class($referenceModel);
            $transactionData['reference_id'] = $referenceModel->id ?? null;
        }

        TreasuryTransaction::create($transactionData);

        return $this;
    }

    /**
     * خصم مبلغ من المال العام (مصروف)
     * 
     * @param float $amount المبلغ
     * @param string $description وصف المعاملة
     * @param string $category فئة المعاملة
     * @param int|null $purchaseId معرف الشراء (إن وجد)
     * @param int|null $orderId معرف الطلب (إن وجد)
     * @param string|null $transactionDate تاريخ المعاملة
     * @param object|null $referenceModel نموذج مرجعي
     * @return $this
     */
    public function addExpense($amount, $description, $category = 'other', $purchaseId = null, $orderId = null, $transactionDate = null, $referenceModel = null)
    {
        $this->balance -= $amount;
        $this->total_expenses += $amount;
        $this->save();

        $transactionData = [
            'transaction_number' => 'EXP-' . time() . '-' . rand(1000, 9999),
            'type' => 'expense',
            'amount' => $amount,
            'description' => $description,
            'category' => $category,
            'purchase_id' => $purchaseId,
            'order_id' => $orderId,
            'created_by' => Auth::check() ? Auth::id() : 1,
            'transaction_date' => $transactionDate ?? now()->format('Y-m-d'),
            'status' => 'completed',
            'payment_method' => 'cash'
        ];
        
        // ربط polymorphic إذا تم تمرير نموذج مرجعي
        if ($referenceModel) {
            $transactionData['reference_type'] = get_class($referenceModel);
            $transactionData['reference_id'] = $referenceModel->id ?? null;
        }

        TreasuryTransaction::create($transactionData);

        return $this;
    }

    /**
     * تسجيل عملية شراء في الخزنة
     */
    public function recordPurchase(Purchase $purchase)
    {
        if ($purchase->payment_method === 'cash' && $purchase->paid_amount > 0) {
            $this->addExpense(
                amount: $purchase->paid_amount,
                description: "شراء من المورد - فاتورة #{$purchase->invoice_number}",
                category: 'purchases',
                purchaseId: $purchase->id,
                referenceModel: $purchase
            );
        }
        
        return $this;
    }

    /**
     * الحصول على رصيد آمن (تحديث أولاً)
     */
    public function getSafeBalance(): float
    {
        $this->refresh();
        return (float) $this->balance;
    }

    /**
     * ==================
     * العلاقات
     * ==================
     */

    /**
     * علاقة مع معاملات الخزنة
     */
    public function transactions()
    {
        return $this->hasMany(TreasuryTransaction::class);
    }

    /**
     * معاملات المشتريات فقط
     */
    public function purchaseTransactions()
    {
        return $this->transactions()->where('category', 'purchases');
    }

    /**
     * إجمالي المشتريات
     */
    public function getTotalPurchases(): float
    {
        return (float) $this->transactions()
            ->where('category', 'purchases')
            ->where('type', 'expense')
            ->sum('amount');
    }
}

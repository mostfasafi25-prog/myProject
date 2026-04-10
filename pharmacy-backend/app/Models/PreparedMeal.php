<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PreparedMeal extends Model
{
    use HasFactory;

    protected $fillable = [
        'meal_name',
        'saved_meal_id',
        'ingredients',
        'total_cost',
        'quantity',
        'prepared_by',
        'notes',
        'prepared_at',
        'returned_at',
        'returned_by',        'sale_price',     // ⬅️ تأكد من وجود

        'return_reason'
    ];

    protected $casts = [
        'ingredients' => 'array',
        'prepared_at' => 'datetime',
        'returned_at' => 'datetime',
         'sale_price' => 'decimal:2',    // ⬅️ أضف
        'total_cost' => 'decimal:2'
    ];

    // العلاقة مع الوجبات المحفوظة
    public function savedMeal()
    {
        return $this->belongsTo(SavedMeal::class);
    }

    // التحقق إذا كانت مسترجعة
    public function getIsReturnedAttribute()
    {
        return !is_null($this->returned_at);
    }
}
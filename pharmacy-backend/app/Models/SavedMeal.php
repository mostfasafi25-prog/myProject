<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SavedMeal extends Model
{
    protected $fillable = [
        'name',
        'ingredients',
        'total_cost',      // ⬅️ ناقص
        'sale_price',
        'profit_margin',
        'used_count',      // ⬅️ ناقص
        'prepared_at'
    ];
    
    protected $casts = [
        'ingredients' => 'array',
        'total_cost' => 'decimal:2',    // ⬅️ أضف
        'sale_price' => 'decimal:2',    // ⬅️ أضف
        'profit_margin' => 'decimal:2'  // ⬅️ أضف
    ];
}
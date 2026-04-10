<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReturnedMeal extends Model
{
    use HasFactory;

    /**
     * الحقول التي يمكن تعبئتها بشكل جماعي
     *
     * @var array
     */
    protected $fillable = [
        'saved_meal_id',
        'meal_name',
        'ingredients',
        'total_cost',
        'returned_by',
        'return_date'
    ];

    /**
     * الحقول التي يجب أن تكون من نوع JSON
     *
     * @var array
     */
    protected $casts = [
        'ingredients' => 'array',
        'return_date' => 'datetime',
        'total_cost' => 'decimal:2'
    ];

    /**
     * العلاقة مع الوجبة المحفوظة
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function savedMeal()
    {
        return $this->belongsTo(SavedMeal::class);
    }
}
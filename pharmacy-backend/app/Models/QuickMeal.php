<?php



// app/Models/QuickMeal.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuickMeal extends Model
{
    protected $fillable = [
        'meal_name',
        'ingredients',
        'total_cost',
        'prepared_by'
    ];
    
    protected $casts = [
        'ingredients' => 'array'
    ];
}